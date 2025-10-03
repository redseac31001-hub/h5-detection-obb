import { ModelManager } from '@/utils/modelManager'
import { YOLODetectionService, type YOLODetectionResult } from './yoloDetectionService'
import type { DetectionResult, VideoFrame } from '@/types'

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

      // 初始化新的YOLO检测服务
      const yoloLoaded = await this.yoloService.initialize()

      // 保持向后兼容，如果新YOLO服务失败，尝试加载旧的模型管理器
      let legacyLoaded = false
      if (!yoloLoaded) {
        try {
          console.log('🔄 新YOLO服务加载失败，尝试旧模型管理器...')
          legacyLoaded = await this.modelManager.loadModel('yolo', this.modelPaths.yolo)
        } catch (error) {
          console.warn('⚠️ 旧模型管理器也加载失败:', error)
        }
      }

      this.isInitialized = yoloLoaded || legacyLoaded

      if (this.isInitialized) {
        console.log('✅ 检测服务初始化成功')
        if (yoloLoaded) {
          console.log('🎯 新YOLO检测服务已就绪')
        }
        if (legacyLoaded) {
          console.log('📦 旧模型管理器已就绪，已加载模型:', this.modelManager.getLoadedModels())
        }
        this.startProcessingQueue()
      } else {
        console.error('❌ 检测服务初始化失败')
      }

      return this.isInitialized
    } catch (error) {
      console.error('❌ 检测服务初始化错误:', error)
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