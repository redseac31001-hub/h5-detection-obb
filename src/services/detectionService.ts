import { ModelManager } from '@/utils/modelManager'
import { YOLODetectionService, type YOLODetectionResult } from './yoloDetectionService'
import type { DetectionResult, VideoFrame } from '@/types'
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl'; // 或 wasm/cpu

export class DetectionService {
  private modelManager: ModelManager
  private yoloService: YOLODetectionService
  private isInitialized = false
  private detectionQueue: VideoFrame[] = []
  private isProcessing = false

  private readonly modelPaths = {
    yolo: '/public/models/yolodetection/model.json'
  }

  constructor() {
    this.modelManager = new ModelManager()
    this.yoloService = new YOLODetectionService({
      modelUrl: this.modelPaths.yolo,
      confidenceThreshold: 0.1,
      iouThreshold: 0.5,
      maxDetections: 50
    })
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 初始化检测服务...')

      // 优先使用新的YOLO检测服务，避免ModelManager的验证问题
      const yoloLoaded = await this.yoloService.initialize()

      if (yoloLoaded) {
        this.isInitialized = true
        console.log('✅ 检测服务初始化成功')
        console.log('🎯 YOLO检测服务已就绪')
        this.startProcessingQueue()
        return true
      } 

      // 如果YOLO服务失败，尝试跳过验证的简单模型加载
      console.log('🔄 YOLO服务失败，尝试简单模型加载...')
      try {
        // 直接加载模型，跳过验证步骤
        const model = await this.loadModelWithoutValidation('yolo', this.modelPaths.yolo)
        if (model) {
          this.isInitialized = true
          console.log('✅ 检测服务初始化成功 (跳过验证)')
          this.startProcessingQueue()
          return true
        }
      } catch (error) {
        console.warn('⚠️ 简单模型加载也失败:', error)
      }

      console.error('❌ 所有初始化方法都失败')
      this.isInitialized = false
      return false

    } catch (error) {
      console.error('❌ 检测服务初始化错误:', error)
      this.isInitialized = false
      return false
    }
  }

  private async loadModelWithoutValidation(modelName: string, modelPath: string): Promise<boolean> {
    try {
      console.log(`🔄 简单加载模型 (跳过验证): ${modelName}`)
      
      // 确保TensorFlow.js初始化
      const tfReady = await this.ensureTensorFlowReady()
      if (!tfReady) {
        throw new Error('TensorFlow.js初始化失败')
      }

      // 直接加载模型，不进行验证推理
      const model = await tf.loadGraphModel(modelPath)
      console.log(`✅ 模型加载成功: ${modelName}`)
      console.log(`📊 输入形状:`, model.inputs.map(input => input.shape))
      console.log(`📊 输出形状:`, model.outputs.map(output => output.shape))
      
      // 简单存储模型，不进行验证
      this.modelManager.setModelDirectly(modelName, model)
      
      return true
    } catch (error) {
      console.error(`❌ 简单模型加载失败: ${modelName}`, error)
      return false
    }
  }

  private async ensureTensorFlowReady(): Promise<boolean> {
    try {
      // 简化的TensorFlow初始化
      await tf.ready()
      
      const backends = ['webgl', 'cpu']
      for (const backend of backends) {
        try {
          await tf.setBackend(backend)
          await tf.ready()
          console.log(`✅ ${backend} 后端就绪`)
          return true
        } catch (error) {
          console.warn(`⚠️ ${backend} 后端失败:`, error)
        }
      }
      
      return false
    } catch (error) {
      console.error('❌ TensorFlow初始化失败:', error)
      return false
    }
  }

  async detectObjects(frame: VideoFrame): Promise<DetectionResult[]> {
    if (!this.isInitialized) {
      return []
    }

    this.detectionQueue.push(frame)
    
    if (this.detectionQueue.length > 5) {
      this.detectionQueue.shift()
    }

    return []
  }

  private async startProcessingQueue() {
    const processLoop = async () => {
      if (this.detectionQueue.length > 0 && !this.isProcessing) {
        this.isProcessing = true
        const frame = this.detectionQueue.shift()
        
        if (frame && this.isInitialized) {
          try {
            const yoloDetections = await this.modelManager.predict('yolo', frame.canvas)
            this.onDetectionComplete(yoloDetections, frame)
          } catch (error) {
            console.error('检测处理错误:', error)
          }
        }
        
        this.isProcessing = false
      }
      
      requestAnimationFrame(processLoop)
    }
    
    processLoop()
  }

  private onDetectionComplete(detections: DetectionResult[], frame: VideoFrame) {
    const event = new CustomEvent('detectionComplete', {
      detail: { detections, frame }
    })
    window.dispatchEvent(event)
  }

  async detectObjectsFromImage(imageData: ImageData): Promise<DetectionResult[]> {
    if (!this.isInitialized || !this.yoloService.loaded) {
      return []
    }

    try {
      // 使用新的YOLO检测服务
      const yoloResults = await this.yoloService.detectObjects(imageData)
      
      // 转换为统一的DetectionResult格式
      return yoloResults.map(result => ({
        id: result.id,
        class: result.class,
        confidence: result.confidence,
        bbox: result.bbox,
        timestamp: result.timestamp
      }))
    } catch (error) {
      console.error('❌ YOLO检测失败:', error)
      
      // 尝试回退到旧的模型管理器
      if (this.modelManager.isModelLoaded('yolo')) {
        try {
          console.log('🔄 回退到旧模型管理器...')
          return await this.modelManager.predict('yolo', imageData)
        } catch (fallbackError) {
          console.error('❌ 回退检测也失败:', fallbackError)
        }
      }
      
      return []
    }
  }

  async detectFaces(imageData: ImageData): Promise<DetectionResult[]> {
    const allDetections = await this.detectObjectsFromImage(imageData)
    return allDetections.filter(detection => detection.class === 'face' || detection.class === 'person')
  }

  async detectPlates(imageData: ImageData): Promise<DetectionResult[]> {
    const allDetections = await this.detectObjectsFromImage(imageData)
    return allDetections.filter(detection => 
      detection.class.includes('Dish') || 
      detection.class.includes('Bowl') || 
      detection.class.includes('Plate') ||
      detection.class.includes('Container') ||
      detection.class.includes('Fruit_Bowl') ||
      detection.class.includes('Noodle_Bowl') ||
      detection.class.includes('Yogurt_Container')
    )
  }

  cropDetection(canvas: HTMLCanvasElement, bbox: { x: number; y: number; width: number; height: number }): HTMLCanvasElement {
    const cropCanvas = document.createElement('canvas')
    const cropCtx = cropCanvas.getContext('2d')
    
    if (!cropCtx) {
      throw new Error('无法创建裁剪画布')
    }

    const { x, y, width, height } = bbox
    cropCanvas.width = width
    cropCanvas.height = height
    
    cropCtx.drawImage(
      canvas,
      x, y, width, height,
      0, 0, width, height
    )

    return cropCanvas
  }

  dispose() {
    this.modelManager.dispose()
    this.yoloService.dispose()
    this.isInitialized = false
    this.detectionQueue = []
  }

  /**
   * 获取YOLO检测服务实例 - 用于高级功能
   */
  getYOLOService(): YOLODetectionService {
    return this.yoloService
  }

  /**
   * 计算检测结果的总价格
   */
  calculateTotalPrice(detections: DetectionResult[]): number {
    return detections.reduce((total, detection) => {
      return total + this.yoloService.getClassPrice(detection.class)
    }, 0)
  }

  /**
   * 更新YOLO检测配置
   */
  updateYOLOConfig(config: {
    confidenceThreshold?: number
    iouThreshold?: number
    maxDetections?: number
  }): void {
    this.yoloService.updateConfig(config)
  }

  get initialized(): boolean {
    return this.isInitialized
  }
}