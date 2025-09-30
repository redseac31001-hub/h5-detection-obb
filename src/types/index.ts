export interface DetectionResult {
  id: string
  class: string
  confidence: number
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
  timestamp: number
}

export interface FaceDetection extends DetectionResult {
  landmarks?: Array<{ x: number; y: number }>
  faceId?: string
}

export interface PlateDetection extends DetectionResult {
  dishes?: DishDetection[]
  totalPrice?: number
}

export interface DishDetection extends DetectionResult {
  name: string
  price: number
}

export interface VideoFrame {
  canvas: HTMLCanvasElement
  timestamp: number
  width: number
  height: number
}

export interface ModelConfig {
  modelUrl: string
  inputSize: number
  scoreThreshold: number
  iouThreshold: number
  maxDetections: number
}

export interface CameraConfig {
  deviceId?: string
  width: number
  height: number
  facingMode: 'user' | 'environment'
}

export interface AppState {
  isModelLoaded: boolean
  isDetecting: boolean
  currentDetections: DetectionResult[]
  faceDetections: FaceDetection[]
  plateDetections: PlateDetection[]
  totalAmount: number
  selectedFaceId?: string
}