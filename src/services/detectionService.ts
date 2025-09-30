import { ModelManager } from '@/utils/modelManager'
import type { DetectionResult, VideoFrame } from '@/types'

export class DetectionService {
  private modelManager: ModelManager
  private isInitialized = false
  private detectionQueue: VideoFrame[] = []
  private isProcessing = false

  private readonly modelPaths = {
    yolo: '/models/yolodetection/model.json'
  }

  constructor() {
    this.modelManager = new ModelManager()
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('初始化检测服务...')

      const yoloLoaded = await this.modelManager.loadModel('yolo', this.modelPaths.yolo)

      this.isInitialized = yoloLoaded

      if (this.isInitialized) {
        console.log('检测服务初始化成功')
        console.log('已加载模型:', this.modelManager.getLoadedModels())
        this.startProcessingQueue()
      } else {
        console.error('检测服务初始化失败')
      }

      return this.isInitialized
    } catch (error) {
      console.error('检测服务初始化错误:', error)
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
    if (!this.isInitialized || !this.modelManager.isModelLoaded('yolo')) {
      return []
    }

    try {
      return await this.modelManager.predict('yolo', imageData)
    } catch (error) {
      console.error('YOLO检测失败:', error)
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
      detection.class.includes('Container')
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
    this.isInitialized = false
    this.detectionQueue = []
  }

  get initialized(): boolean {
    return this.isInitialized
  }
}