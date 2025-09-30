import * as tf from '@tensorflow/tfjs'
import type { DetectionResult } from '@/types'

export interface TFObjectDetectionResult {
  detection_boxes: tf.Tensor
  detection_classes: tf.Tensor
  detection_scores: tf.Tensor
  num_detections: tf.Tensor
}

export class TFObjectDetectionAdapter {
  private model: tf.GraphModel | null = null
  private classNames: string[] = []
  private priceMapping: Record<string, number> = {}

  constructor(classNames: string[] = [], priceMapping: Record<string, number> = {}) {
    this.classNames = classNames
    this.priceMapping = priceMapping
  }

  async loadModel(modelUrl: string): Promise<boolean> {
    try {
      console.log('加载TensorFlow Object Detection模型:', modelUrl)
      
      await tf.ready()
      this.model = await tf.loadGraphModel(modelUrl)
      
      console.log('模型加载成功')
      console.log('输入形状:', this.model.inputs.map(input => input.shape))
      console.log('输出形状:', this.model.outputs.map(output => output.shape))
      
      return true
    } catch (error) {
      console.error('模型加载失败:', error)
      return false
    }
  }

  async predict(input: HTMLCanvasElement | ImageData, options: {
    scoreThreshold?: number
    maxDetections?: number
  } = {}): Promise<DetectionResult[]> {
    if (!this.model) {
      throw new Error('模型未加载')
    }

    const scoreThreshold = options.scoreThreshold || 0.5
    const maxDetections = options.maxDetections || 20

    try {
      // 预处理输入
      const inputTensor = this.preprocessInput(input)
      
      // 执行推理
      console.log('执行模型推理...')
      const predictions = this.model.predict(inputTensor) as tf.Tensor[]
      
      // 后处理输出
      const results = await this.postprocessPredictions(predictions, scoreThreshold, maxDetections)
      
      // 清理资源
      inputTensor.dispose()
      predictions.forEach(tensor => tensor.dispose())
      
      return results
    } catch (error) {
      console.error('推理失败:', error)
      return []
    }
  }

  private preprocessInput(input: HTMLCanvasElement | ImageData): tf.Tensor {
    let tensor: tf.Tensor

    // 从输入创建张量
    if (input instanceof ImageData) {
      tensor = tf.browser.fromPixels(input)
    } else {
      tensor = tf.browser.fromPixels(input)
    }

    // TensorFlow Object Detection API通常期望uint8输入
    const uint8Tensor = tensor.cast('int32')
    
    // 添加批次维度
    const batched = uint8Tensor.expandDims(0)
    
    // 清理中间张量
    tensor.dispose()
    uint8Tensor.dispose()
    
    return batched
  }

  private async postprocessPredictions(
    predictions: tf.Tensor[], 
    scoreThreshold: number, 
    maxDetections: number
  ): Promise<DetectionResult[]> {
    // TensorFlow Object Detection API输出格式:
    // [detection_boxes, detection_classes, detection_scores, num_detections]
    
    if (predictions.length < 4) {
      console.error('模型输出格式不正确，期望4个输出张量')
      return []
    }

    const [boxesTensor, classesTensor, scoresTensor, numDetectionsTensor] = predictions
    
    // 获取数据
    const boxes = await boxesTensor.data()
    const classes = await classesTensor.data()
    const scores = await scoresTensor.data()
    const numDetections = await numDetectionsTensor.data()
    
    const results: DetectionResult[] = []
    const actualNumDetections = Math.min(numDetections[0], maxDetections)
    
    console.log(`处理 ${actualNumDetections} 个检测结果`)
    
    for (let i = 0; i < actualNumDetections; i++) {
      const score = scores[i]
      
      if (score < scoreThreshold) {
        continue
      }
      
      // TensorFlow Object Detection API的边界框格式: [ymin, xmin, ymax, xmax] (归一化坐标)
      const ymin = boxes[i * 4]
      const xmin = boxes[i * 4 + 1]
      const ymax = boxes[i * 4 + 2]
      const xmax = boxes[i * 4 + 3]
      
      // 转换为像素坐标 (假设输入图像为640x640)
      const imageWidth = 640
      const imageHeight = 640
      
      const x = xmin * imageWidth
      const y = ymin * imageHeight
      const width = (xmax - xmin) * imageWidth
      const height = (ymax - ymin) * imageHeight
      
      // 获取类别
      const classIndex = Math.floor(classes[i])
      const className = this.getClassName(classIndex)
      
      const detection: DetectionResult = {
        id: `tf_detection_${Date.now()}_${i}`,
        class: className,
        confidence: score,
        bbox: {
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: Math.min(imageWidth - x, width),
          height: Math.min(imageHeight - y, height)
        },
        timestamp: Date.now()
      }
      
      results.push(detection)
    }
    
    console.log(`过滤后得到 ${results.length} 个有效检测`)
    return results
  }

  private getClassName(classIndex: number): string {
    // TensorFlow Object Detection API的类别索引通常从1开始
    const adjustedIndex = classIndex - 1
    
    if (adjustedIndex >= 0 && adjustedIndex < this.classNames.length) {
      return this.classNames[adjustedIndex]
    }
    
    return `class_${classIndex}`
  }

  setClassNames(classNames: string[]) {
    this.classNames = classNames
  }

  setPriceMapping(priceMapping: Record<string, number>) {
    this.priceMapping = priceMapping
  }

  dispose() {
    if (this.model) {
      this.model.dispose()
      this.model = null
    }
  }

  get loaded(): boolean {
    return this.model !== null
  }
}