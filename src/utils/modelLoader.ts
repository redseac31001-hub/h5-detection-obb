import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import type { ModelConfig, DetectionResult } from '@/types'

export class YOLOModelLoader {
  private model: tf.GraphModel | tf.LayersModel | null = null
  private config: ModelConfig
  private isLoaded = false

  constructor(config: ModelConfig) {
    this.config = config
  }

  async loadModel(): Promise<boolean> {
    try {
      console.log('开始加载YOLO模型...')
      
      await tf.ready()
      console.log('TensorFlow.js 后端就绪:', tf.getBackend())

      this.model = await tf.loadGraphModel(this.config.modelUrl)
      this.isLoaded = true
      
      console.log('YOLO模型加载成功')
      console.log('模型输入形状:', this.model.inputs.map(input => input.shape))
      console.log('模型输出形状:', this.model.outputs.map(output => output.shape))
      
      return true
    } catch (error) {
      console.error('模型加载失败:', error)
      this.isLoaded = false
      return false
    }
  }

  async predict(imageData: ImageData | HTMLCanvasElement): Promise<DetectionResult[]> {
    if (!this.model || !this.isLoaded) {
      throw new Error('模型未加载')
    }

    try {
      const tensor = this.preprocessImage(imageData)
      const predictions = await this.model.predict(tensor) as tf.Tensor

      const results = await this.postprocessPredictions(predictions)
      
      tensor.dispose()
      predictions.dispose()
      
      return results
    } catch (error) {
      console.error('模型推理失败:', error)
      return []
    }
  }

  private preprocessImage(imageData: ImageData | HTMLCanvasElement): tf.Tensor {
    let tensor: tf.Tensor

    if (imageData instanceof ImageData) {
      tensor = tf.browser.fromPixels(imageData)
    } else {
      tensor = tf.browser.fromPixels(imageData)
    }

    const resized = tf.image.resizeBilinear(
      tensor as tf.Tensor3D, 
      [this.config.inputSize, this.config.inputSize]
    )
    
    const normalized = resized.div(255.0)
    const batched = normalized.expandDims(0)
    
    tensor.dispose()
    resized.dispose()
    normalized.dispose()
    
    return batched
  }

  private async postprocessPredictions(predictions: tf.Tensor): Promise<DetectionResult[]> {
    const data = await predictions.data()
    const results: DetectionResult[] = []

    const numDetections = predictions.shape[1] || 0
    const numClasses = predictions.shape[2] || 0

    for (let i = 0; i < numDetections; i++) {
      const baseIndex = i * numClasses
      
      const x = data[baseIndex]
      const y = data[baseIndex + 1]
      const width = data[baseIndex + 2]
      const height = data[baseIndex + 3]
      
      let maxScore = 0
      let maxClass = 0
      
      for (let j = 4; j < numClasses; j++) {
        const score = data[baseIndex + j]
        if (score > maxScore) {
          maxScore = score
          maxClass = j - 4
        }
      }

      if (maxScore > this.config.scoreThreshold) {
        results.push({
          id: `detection_${Date.now()}_${i}`,
          class: this.getClassName(maxClass),
          confidence: maxScore,
          bbox: {
            x: x - width / 2,
            y: y - height / 2,
            width,
            height
          },
          timestamp: Date.now()
        })
      }
    }

    return this.applyNMS(results)
  }

  private applyNMS(detections: DetectionResult[]): DetectionResult[] {
    const sortedDetections = detections.sort((a, b) => b.confidence - a.confidence)
    const filteredDetections: DetectionResult[] = []

    for (const detection of sortedDetections) {
      let shouldKeep = true

      for (const kept of filteredDetections) {
        if (detection.class === kept.class) {
          const iou = this.calculateIoU(detection.bbox, kept.bbox)
          if (iou > this.config.iouThreshold) {
            shouldKeep = false
            break
          }
        }
      }

      if (shouldKeep) {
        filteredDetections.push(detection)
      }

      if (filteredDetections.length >= this.config.maxDetections) {
        break
      }
    }

    return filteredDetections
  }

  private calculateIoU(box1: { x: number; y: number; width: number; height: number }, box2: { x: number; y: number; width: number; height: number }): number {
    const x1 = Math.max(box1.x, box2.x)
    const y1 = Math.max(box1.y, box2.y)
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width)
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height)

    if (x2 <= x1 || y2 <= y1) {
      return 0
    }

    const intersection = (x2 - x1) * (y2 - y1)
    const area1 = box1.width * box1.height
    const area2 = box2.width * box2.height
    const union = area1 + area2 - intersection

    return intersection / union
  }

  private getClassName(classIndex: number): string {
    // 根据 metadata.yaml 中定义的类别
    const classNames = [
      'Fruit_Bowl',
      'Large_Dish_for_Vegetables', 
      'Large_Noodle_Bowl',
      'Oval_Plate_for_Staple_Food',
      'Small_Dish_for_Vegetables',
      'Small_Noodle_Bowl',
      'Yogurt_Container'
    ]
    return classNames[classIndex] || 'unknown'
  }

  dispose() {
    if (this.model) {
      this.model.dispose()
      this.model = null
      this.isLoaded = false
    }
  }

  get loaded(): boolean {
    return this.isLoaded
  }
}