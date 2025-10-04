import * as tf from '@tensorflow/tfjs'
import { initializeTensorFlow, isTensorFlowReady, getTensorFlowInfo } from '@/utils/tfUtils'
import type { DetectionResult } from '@/types'
import '@tensorflow/tfjs-backend-webgl'; // 或 wasm/cpu

export interface YOLODetectionConfig {
  modelUrl: string
  confidenceThreshold: number
  iouThreshold: number
  maxDetections: number
  inputSize: number
}

export interface YOLODetectionResult {
  id: string
  class: string
  confidence: number
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
  price?: number
  timestamp: number
}

export class YOLODetectionService {
  private model: tf.GraphModel | null = null
  private isLoaded = false
  private config: YOLODetectionConfig

  // 餐具类别映射 - 根据metadata.yaml
  private readonly classNames = [
    'Fruit_Bowl',
    'Large_Dish_for_Vegetables', 
    'Large_Noodle_Bowl',
    'Oval_Plate_for_Staple_Food',
    'Small_Dish_for_Vegetables',
    'Small_Noodle_Bowl',
    'Yogurt_Container'
  ]

  // 价格映射
  private readonly priceMapping = {
    'Fruit_Bowl': 15.0,
    'Large_Dish_for_Vegetables': 18.0,
    'Large_Noodle_Bowl': 22.0,
    'Oval_Plate_for_Staple_Food': 25.0,
    'Small_Dish_for_Vegetables': 12.0,
    'Small_Noodle_Bowl': 18.0,
    'Yogurt_Container': 8.0
  }

  constructor(config?: Partial<YOLODetectionConfig>) {
    this.config = {
      modelUrl: '/models/yolodetection/model.json',
      confidenceThreshold: 0.1,
      iouThreshold: 0.5,
      maxDetections: 50,
      inputSize: 640,
      ...config
    }
  }

  /**
   * 初始化模型加载
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 正在初始化YOLO检测服务...')
      
      // 采用与fixed.html相同的简单初始化方式
      console.log('🔧 正在初始化 TensorFlow.js...')
      await tf.ready()
      console.log('TensorFlow.js 后端:', tf.getBackend())

      // 直接加载YOLO模型，不进行复杂的验证
      console.log('📥 正在加载 YOLO 模型:', this.config.modelUrl)
      this.model = await tf.loadGraphModel(this.config.modelUrl)
      
      console.log('✅ YOLO模型加载成功')
      console.log('📊 模型输入形状:', this.model.inputs.map(input => input.shape))
      console.log('📊 模型输出形状:', this.model.outputs.map(output => output.shape))
      
      // 跳过测试推理验证，直接标记为就绪
      console.log('✅ 跳过验证推理，模型准备就绪')
      
      this.isLoaded = true
      return true

    } catch (error) {
      console.error('❌ YOLO检测服务初始化失败:', error)
      this.isLoaded = false
      return false
    }
  }

  /**
   * 检测图片中的餐具对象
   */
  async detectObjects(
    imageSource: HTMLImageElement | HTMLCanvasElement | ImageData,
    options?: Partial<YOLODetectionConfig>
  ): Promise<YOLODetectionResult[]> {
    if (!this.model || !this.isLoaded) {
      throw new Error('YOLO模型尚未加载，请先调用 initialize()')
    }

    try {
      // 合并配置选项
      const config = { ...this.config, ...options }
      
      // 预处理图片
      const tensor = this.preprocessImage(imageSource)
      
      // 模型推理
      const predictions = this.model.predict(tensor) as tf.Tensor | tf.Tensor[]
      
      // 获取输出张量
      let outputTensor: tf.Tensor
      if (Array.isArray(predictions)) {
        outputTensor = predictions[0]
      } else {
        outputTensor = predictions
      }

      // 获取图片尺寸
      const { width: imgWidth, height: imgHeight } = this.getImageDimensions(imageSource)
      
      // 后处理预测结果 - 使用修复版本
      const rawDetections = await this.postprocessPredictionsFixed(
        outputTensor, 
        imgWidth, 
        imgHeight
      )
      
      // 应用置信度过滤
      const filteredDetections = rawDetections.filter(
        d => d.confidence >= config.confidenceThreshold
      )
      
      // 应用NMS去重
      const finalDetections = this.applyNMS(filteredDetections, config.iouThreshold)
      
      // 限制最大检测数量
      const limitedDetections = finalDetections.slice(0, config.maxDetections)
      
      console.log(`🎯 检测统计: 原始=${rawDetections.length}, 过滤后=${filteredDetections.length}, NMS后=${finalDetections.length}, 最终=${limitedDetections.length}`)
      
      // 清理内存
      tensor.dispose()
      if (Array.isArray(predictions)) {
        predictions.forEach(p => p.dispose())
      } else {
        predictions.dispose()
      }
      
      return limitedDetections

    } catch (error) {
      console.error('❌ YOLO检测失败:', error)
      throw error
    }
  }

  /**
   * 预处理图片
   */
  private preprocessImage(imageSource: HTMLImageElement | HTMLCanvasElement | ImageData): tf.Tensor {
    let tensor: tf.Tensor

    if (imageSource instanceof ImageData) {
      tensor = tf.browser.fromPixels(imageSource)
    } else {
      tensor = tf.browser.fromPixels(imageSource)
    }

    // 调整尺寸到640x640
    const resized = tf.image.resizeBilinear(
      tensor as tf.Tensor3D, 
      [this.config.inputSize, this.config.inputSize]
    )
    
    // 归一化到0-1
    const normalized = resized.div(255.0)
    
    // 添加批次维度
    const batched = normalized.expandDims(0)
    
    // 清理中间张量
    tensor.dispose()
    resized.dispose()
    normalized.dispose()
    
    return batched
  }

  /**
   * 修复版本的后处理 - 解决坐标格式和数据排列问题
   */
  private async postprocessPredictionsFixed(
    predictions: tf.Tensor,
    imgWidth: number,
    imgHeight: number
  ): Promise<YOLODetectionResult[]> {
    const data = await predictions.data()
    const shape = predictions.shape
    const detections: YOLODetectionResult[] = []

    console.log('🔍 预测输出形状:', shape)
    
    if (shape.length === 3 && shape[0] === 1) {
      const [batch, features, numDetections] = shape
      console.log(`📊 YOLO格式: [${batch}, ${features}, ${numDetections}]`)
      
      // 计算从640x640到实际图片尺寸的缩放比例 - 关键修复点！
      const scaleX = imgWidth / this.config.inputSize
      const scaleY = imgHeight / this.config.inputSize
      
      console.log(`📏 坐标缩放比例: x=${scaleX.toFixed(3)}, y=${scaleY.toFixed(3)}`)
      
      for (let i = 0; i < numDetections; i++) {
        // 按特征排列的数据读取方式 - 关键修复点！
        const xCenter = data[0 * numDetections + i] * scaleX
        const yCenter = data[1 * numDetections + i] * scaleY
        const width = data[2 * numDetections + i] * scaleX
        const height = data[3 * numDetections + i] * scaleY
        
        // 找到最高置信度的类别
        let maxClassScore = 0
        let maxClassIndex = 0
        
        for (let classIdx = 0; classIdx < this.classNames.length; classIdx++) {
          const score = data[(4 + classIdx) * numDetections + i]
          if (score > maxClassScore) {
            maxClassScore = score
            maxClassIndex = classIdx
          }
        }
        
        // 收集所有有效候选（用极低阈值）
        if (maxClassScore > 0.001) {
          // 验证坐标合理性
          if (this.isValidBBox(xCenter, yCenter, width, height, imgWidth, imgHeight)) {
            // 转换为左上角坐标
            const x = Math.max(0, xCenter - width / 2)
            const y = Math.max(0, yCenter - height / 2)
            const w = Math.min(imgWidth - x, width)
            const h = Math.min(imgHeight - y, height)
            
            if (w > 5 && h > 5) { // 最小尺寸检查
              const className = this.classNames[maxClassIndex]
              
              detections.push({
                id: `yolo_${Date.now()}_${i}`,
                class: className,
                confidence: maxClassScore,
                bbox: { x, y, width: w, height: h },
                price: this.priceMapping[className as keyof typeof this.priceMapping],
                timestamp: Date.now()
              })
            }
          }
        }
      }
    }
    
    return detections
  }

  /**
   * 验证边界框是否有效
   */
  private isValidBBox(
    xCenter: number, 
    yCenter: number, 
    width: number, 
    height: number,
    imgWidth: number, 
    imgHeight: number
  ): boolean {
    return (
      xCenter >= 0 && xCenter <= imgWidth &&
      yCenter >= 0 && yCenter <= imgHeight &&
      width > 0 && width <= imgWidth * 2 &&
      height > 0 && height <= imgHeight * 2
    )
  }

  /**
   * 应用非极大值抑制 (NMS)
   */
  private applyNMS(
    detections: YOLODetectionResult[], 
    iouThreshold: number
  ): YOLODetectionResult[] {
    if (detections.length === 0) return detections

    // 按置信度降序排列
    const sortedDetections = detections.sort((a, b) => b.confidence - a.confidence)
    const selectedDetections: YOLODetectionResult[] = []

    for (const currentDetection of sortedDetections) {
      let shouldKeep = true

      for (const selectedDetection of selectedDetections) {
        const iou = this.calculateIoU(currentDetection.bbox, selectedDetection.bbox)
        if (iou > iouThreshold) {
          shouldKeep = false
          break
        }
      }

      if (shouldKeep) {
        selectedDetections.push(currentDetection)
      }
    }

    return selectedDetections
  }

  /**
   * 计算两个边界框的IoU (Intersection over Union)
   */
  private calculateIoU(
    box1: { x: number; y: number; width: number; height: number },
    box2: { x: number; y: number; width: number; height: number }
  ): number {
    const x1 = Math.max(box1.x, box2.x)
    const y1 = Math.max(box1.y, box2.y)
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width)
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height)

    if (x2 <= x1 || y2 <= y1) return 0

    const intersection = (x2 - x1) * (y2 - y1)
    const area1 = box1.width * box1.height
    const area2 = box2.width * box2.height
    const union = area1 + area2 - intersection

    return intersection / union
  }

  /**
   * 获取图片尺寸
   */
  private getImageDimensions(imageSource: HTMLImageElement | HTMLCanvasElement | ImageData): {
    width: number
    height: number
  } {
    if (imageSource instanceof ImageData) {
      return { width: imageSource.width, height: imageSource.height }
    } else {
      return { width: imageSource.width, height: imageSource.height }
    }
  }

  /**
   * 计算检测结果的总价格
   */
  calculateTotalPrice(detections: YOLODetectionResult[]): number {
    return detections.reduce((total, detection) => {
      return total + (detection.price || 0)
    }, 0)
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<YOLODetectionConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 获取支持的类别列表
   */
  getSupportedClasses(): string[] {
    return [...this.classNames]
  }

  /**
   * 获取类别价格
   */
  getClassPrice(className: string): number {
    return this.priceMapping[className as keyof typeof this.priceMapping] || 0
  }

  /**
   * 释放资源
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose()
      this.model = null
      this.isLoaded = false
      console.log('✅ YOLO检测服务已释放')
    }
  }

  /**
   * 检查模型是否已加载
   */
  get loaded(): boolean {
    return this.isLoaded
  }

  /**
   * 获取当前配置
   */
  get currentConfig(): YOLODetectionConfig {
    return { ...this.config }
  }
}