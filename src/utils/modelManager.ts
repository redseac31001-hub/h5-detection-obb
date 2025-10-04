import * as tf from '@tensorflow/tfjs'
import { initializeTensorFlow, isTensorFlowReady, getTensorFlowInfo } from './tfUtils'
import { TFObjectDetectionAdapter } from './tfObjectDetectionAdapter'
import type { ModelConfig, DetectionResult } from '@/types'

export interface ModelInfo {
  name: string
  version: string
  description: string
  input_shape: number[]
  output_shape: number[]
  classes: string[]
  price_mapping?: Record<string, number>
  confidence_threshold: number
  iou_threshold: number
  max_detections: number
  preprocessing: {
    normalize: boolean
    mean: number[]
    std: number[]
  }
  postprocessing: {
    format: string
    bbox_format: string
    output_format: string
  }
}

export class ModelManager {
  private models: Map<string, tf.GraphModel> = new Map()
  private tfObjectDetectionAdapters: Map<string, TFObjectDetectionAdapter> = new Map()
  private modelInfos: Map<string, ModelInfo> = new Map()
  private isInitialized = false

  constructor() {
    console.log('ModelManager initialized')
  }

  async loadModel(modelName: string, modelPath: string): Promise<boolean> {
    try {
      console.log(`🔄 开始加载模型: ${modelName}`)
      
      // 确保TensorFlow.js已正确初始化
      if (!isTensorFlowReady()) {
        console.log('🔧 TensorFlow.js尚未就绪，正在初始化...')
        const tfInitialized = await initializeTensorFlow()
        if (!tfInitialized) {
          throw new Error('TensorFlow.js初始化失败')
        }
      }
      
      // 显示TensorFlow.js信息
      const tfInfo = getTensorFlowInfo()
      console.log(`✅ TensorFlow.js信息:`, tfInfo)

      // 加载模型信息
      const modelInfoPath = `${modelPath.replace('/model.json', '')}/model_info.json`
      let modelInfo: ModelInfo | undefined
      
      try {
        const infoResponse = await fetch(modelInfoPath)
        if (infoResponse.ok) {
          modelInfo = await infoResponse.json()
          this.modelInfos.set(modelName, modelInfo)
          console.log(`模型信息加载成功: ${modelName}`, modelInfo)
        }
      } catch (error) {
        console.warn(`模型信息文件加载失败: ${modelInfoPath}`, error)
      }

      // 尝试加载模型并检测类型
      const model = await tf.loadGraphModel(modelPath)
      
      // 检测是否为TensorFlow Object Detection API模型
      const isTFObjectDetection = this.detectModelType(model)
      
      if (isTFObjectDetection) {
        console.log(`检测到TensorFlow Object Detection API模型: ${modelName}`)
        
        // 使用TFObjectDetectionAdapter
        const classes = modelInfo?.classes || []
        const priceMapping = modelInfo?.price_mapping || {}
        const adapter = new TFObjectDetectionAdapter(classes, priceMapping)
        
        const success = await adapter.loadModel(modelPath)
        if (success) {
          this.tfObjectDetectionAdapters.set(modelName, adapter)
          console.log(`TF Object Detection模型加载成功: ${modelName}`)
          return true
        } else {
          throw new Error(`TF Object Detection模型加载失败: ${modelName}`)
        }
      } else {
        // 使用标准YOLO处理
        this.models.set(modelName, model)
        
        // 验证模型
        const isValid = await this.validateModel(modelName)
        if (!isValid) {
          throw new Error(`模型验证失败: ${modelName}`)
        }
        
        console.log(`YOLO模型加载成功: ${modelName}`)
        console.log(`输入形状:`, model.inputs.map(input => input.shape))
        console.log(`输出形状:`, model.outputs.map(output => output.shape))
        return true
      }
    } catch (error) {
      console.error(`模型加载失败: ${modelName}`, error)
      this.models.delete(modelName)
      this.tfObjectDetectionAdapters.delete(modelName)
      this.modelInfos.delete(modelName)
      return false
    }
  }

  private detectModelType(model: tf.GraphModel): boolean {
    // 通过输出节点名称检测TensorFlow Object Detection API模型
    const outputNames = model.outputNodes.map(node => (node as any).name || '')
    
    const tfObjectDetectionOutputs = [
      'detection_boxes',
      'detection_classes', 
      'detection_scores',
      'num_detections'
    ]
    
    const hasObjectDetectionOutputs = tfObjectDetectionOutputs.some(outputName =>
      outputNames.some((name: string) => name.includes(outputName))
    )
    
    // 也可以通过输出数量判断 (TF Object Detection通常有4个输出)
    const hasMultipleOutputs = model.outputs.length >= 4
    
    return hasObjectDetectionOutputs || hasMultipleOutputs
  }

  async validateModel(modelName: string): Promise<boolean> {
    const model = this.models.get(modelName)
    if (!model) return false

    try {
      // 确保TensorFlow.js就绪后再进行验证
      if (!isTensorFlowReady()) {
        console.warn(`⚠️ TensorFlow.js未就绪，强制初始化后再验证: ${modelName}`)
        const tfInitialized = await initializeTensorFlow()
        if (!tfInitialized) {
          console.error(`❌ TensorFlow.js初始化失败，跳过验证: ${modelName}`)
          return false
        }
      }

      // 获取模型的实际输入形状
      const inputShape = model.inputs[0].shape
      console.log(`🔍 模型实际输入形状: ${inputShape}`)
      
      // 创建与模型输入形状匹配的测试输入
      let testInputShape: number[]
      if (inputShape && inputShape.every(dim => dim && dim > 0)) {
        testInputShape = inputShape as number[]
      } else {
        // 如果形状包含null或-1，使用默认形状
        testInputShape = [1, 640, 640, 3]
      }
      
      const testInput = tf.randomNormal(testInputShape)
      
      // 执行推理测试
      const prediction = model.predict(testInput)
      
      // 处理多输出情况
      if (Array.isArray(prediction)) {
        console.log(`✅ 模型 ${modelName} 验证成功，输出数量: ${prediction.length}`)
        console.log(`输出形状:`, prediction.map(p => p.shape))
        prediction.forEach(p => p.dispose())
      } else {
        console.log(`✅ 模型 ${modelName} 验证成功，输出形状:`, prediction.shape)
        prediction.dispose()
      }
      
      // 清理资源
      testInput.dispose()
      
      return true
    } catch (error) {
      console.error(`❌ 模型验证失败: ${modelName}`, error)
      return false
    }
  }

  async predict(modelName: string, input: ImageData | HTMLCanvasElement): Promise<DetectionResult[]> {
    // 检查是否为TF Object Detection模型
    const tfAdapter = this.tfObjectDetectionAdapters.get(modelName)
    if (tfAdapter) {
      const modelInfo = this.modelInfos.get(modelName)
      return await tfAdapter.predict(input, {
        scoreThreshold: modelInfo?.confidence_threshold || 0.5,
        maxDetections: modelInfo?.max_detections || 20
      })
    }
    
    // 标准YOLO模型处理
    const model = this.models.get(modelName)
    const modelInfo = this.modelInfos.get(modelName)
    
    if (!model) {
      throw new Error(`模型未加载: ${modelName}`)
    }

    try {
      // 预处理输入
      const inputTensor = this.preprocessInput(input, modelInfo)
      
      // 执行推理
      const prediction = model.predict(inputTensor) as tf.Tensor
      
      // 后处理输出
      const results = await this.postprocessOutput(prediction, modelInfo, modelName)
      
      // 清理资源
      inputTensor.dispose()
      prediction.dispose()
      
      return results
    } catch (error) {
      console.error(`模型推理失败: ${modelName}`, error)
      return []
    }
  }

  private preprocessInput(input: ImageData | HTMLCanvasElement, modelInfo?: ModelInfo): tf.Tensor {
    let tensor: tf.Tensor

    // 从输入创建张量
    if (input instanceof ImageData) {
      tensor = tf.browser.fromPixels(input)
    } else {
      tensor = tf.browser.fromPixels(input)
    }

    // 调整尺寸到模型输入尺寸
    const inputSize = modelInfo?.input_shape?.[1] || 640
    const resized = tf.image.resizeBilinear(
      tensor as tf.Tensor3D,
      [inputSize, inputSize]
    )

    // 归一化
    let normalized: tf.Tensor
    if (modelInfo?.preprocessing?.normalize) {
      const mean = tf.tensor(modelInfo.preprocessing.mean || [0, 0, 0])
      const std = tf.tensor(modelInfo.preprocessing.std || [255, 255, 255])
      normalized = resized.sub(mean).div(std)
      mean.dispose()
      std.dispose()
    } else {
      normalized = resized.div(255.0)
    }

    // 添加批次维度
    const batched = normalized.expandDims(0)

    // 清理中间张量
    tensor.dispose()
    resized.dispose()
    normalized.dispose()

    return batched
  }

  private async postprocessOutput(
    prediction: tf.Tensor, 
    modelInfo?: ModelInfo, 
    modelName?: string
  ): Promise<DetectionResult[]> {
    const data = await prediction.data()
    const shape = prediction.shape
    
    if (shape.length !== 3) {
      throw new Error(`不支持的输出形状: ${shape}`)
    }

    const [batchSize, numDetections, numFeatures] = shape
    const results: DetectionResult[] = []
    
    // 获取配置
    const confidenceThreshold = modelInfo?.confidence_threshold || 0.5
    const maxDetections = modelInfo?.max_detections || 20
    const classes = modelInfo?.classes || []
    const priceMapping = modelInfo?.price_mapping || {}

    // 解析检测结果
    for (let i = 0; i < numDetections; i++) {
      const baseIndex = i * numFeatures
      
      if (baseIndex + 4 >= data.length) break

      // 提取边界框坐标 (YOLO格式: center_x, center_y, width, height)
      const centerX = data[baseIndex]
      const centerY = data[baseIndex + 1] 
      const width = data[baseIndex + 2]
      const height = data[baseIndex + 3]

      // 转换为左上角坐标格式
      const x = centerX - width / 2
      const y = centerY - height / 2

      // 提取置信度和类别
      let maxConfidence = 0
      let maxClassIndex = 0

      if (numFeatures === 6) {
        // 单类别检测 (如人脸检测)
        maxConfidence = data[baseIndex + 4]
        maxClassIndex = Math.floor(data[baseIndex + 5] || 0)
      } else {
        // 多类别检测
        for (let j = 5; j < numFeatures; j++) {
          const confidence = data[baseIndex + j]
          if (confidence > maxConfidence) {
            maxConfidence = confidence
            maxClassIndex = j - 5
          }
        }
      }

      // 过滤低置信度检测
      if (maxConfidence < confidenceThreshold) continue

      // 获取类别名称
      const className = classes[maxClassIndex] || `class_${maxClassIndex}`
      
      // 创建检测结果
      const detection: DetectionResult = {
        id: `${modelName}_${Date.now()}_${i}`,
        class: className,
        confidence: maxConfidence,
        bbox: {
          x: Math.max(0, x * 640), // 假设输出是归一化的
          y: Math.max(0, y * 640),
          width: Math.min(640, width * 640),
          height: Math.min(640, height * 640)
        },
        timestamp: Date.now()
      }

      results.push(detection)
    }

    // 应用NMS (非极大值抑制)
    const filteredResults = this.applyNMS(results, modelInfo?.iou_threshold || 0.5)
    
    // 限制检测数量
    return filteredResults.slice(0, maxDetections)
  }

  private applyNMS(detections: DetectionResult[], iouThreshold: number): DetectionResult[] {
    // 按置信度排序
    const sortedDetections = detections.sort((a, b) => b.confidence - a.confidence)
    const filteredDetections: DetectionResult[] = []

    for (const detection of sortedDetections) {
      let shouldKeep = true

      for (const kept of filteredDetections) {
        if (detection.class === kept.class) {
          const iou = this.calculateIoU(detection.bbox, kept.bbox)
          if (iou > iouThreshold) {
            shouldKeep = false
            break
          }
        }
      }

      if (shouldKeep) {
        filteredDetections.push(detection)
      }
    }

    return filteredDetections
  }

  private calculateIoU(
    box1: { x: number; y: number; width: number; height: number },
    box2: { x: number; y: number; width: number; height: number }
  ): number {
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

  getModelInfo(modelName: string): ModelInfo | undefined {
    return this.modelInfos.get(modelName)
  }

  isModelLoaded(modelName: string): boolean {
    return this.models.has(modelName) || this.tfObjectDetectionAdapters.has(modelName)
  }

  getLoadedModels(): string[] {
    const yoloModels = Array.from(this.models.keys())
    const tfModels = Array.from(this.tfObjectDetectionAdapters.keys())
    return [...yoloModels, ...tfModels]
  }

  /**
   * 直接设置模型，跳过验证 - 用于紧急修复
   */
  setModelDirectly(modelName: string, model: tf.GraphModel): void {
    this.models.set(modelName, model)
    console.log(`✅ 直接设置模型: ${modelName}`)
  }

  dispose(): void {
    // 清理所有YOLO模型
    for (const [name, model] of this.models) {
      console.log(`释放YOLO模型: ${name}`)
      model.dispose()
    }
    
    // 清理所有TF Object Detection模型
    for (const [name, adapter] of this.tfObjectDetectionAdapters) {
      console.log(`释放TF Object Detection模型: ${name}`)
      adapter.dispose()
    }
    
    this.models.clear()
    this.tfObjectDetectionAdapters.clear()
    this.modelInfos.clear()
    this.isInitialized = false
  }
}