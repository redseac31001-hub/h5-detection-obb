import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DetectionResult, FaceDetection, PlateDetection } from '@/types'

export const useDetectionStore = defineStore('detection', () => {
  const isModelLoaded = ref(false)
  const isDetecting = ref(false)
  const currentDetections = ref<DetectionResult[]>([])
  const faceDetections = ref<FaceDetection[]>([])
  const plateDetections = ref<PlateDetection[]>([])
  const selectedFaceId = ref<string>()

  const totalAmount = computed(() => {
    return plateDetections.value.reduce((sum, plate) => {
      return sum + (plate.totalPrice || 0)
    }, 0)
  })

  const latestFaceDetection = computed(() => {
    return faceDetections.value[faceDetections.value.length - 1]
  })

  const activePlates = computed(() => {
    return plateDetections.value.filter(plate => 
      Date.now() - plate.timestamp < 5000
    )
  })

  function setModelLoaded(loaded: boolean) {
    isModelLoaded.value = loaded
  }

  function setDetecting(detecting: boolean) {
    isDetecting.value = detecting
  }

  function addDetection(detection: DetectionResult) {
    currentDetections.value.push(detection)
    
    if (detection.class === 'face') {
      faceDetections.value.push(detection as FaceDetection)
      if (faceDetections.value.length > 10) {
        faceDetections.value.shift()
      }
    } else if (detection.class === 'plate') {
      plateDetections.value.push(detection as PlateDetection)
      if (plateDetections.value.length > 20) {
        plateDetections.value.shift()
      }
    }
  }

  function clearDetections() {
    currentDetections.value = []
    faceDetections.value = []
    plateDetections.value = []
    selectedFaceId.value = undefined
  }

  function selectFace(faceId: string) {
    selectedFaceId.value = faceId
  }

  function updatePlatePrice(plateId: string, price: number) {
    const plate = plateDetections.value.find(p => p.id === plateId)
    if (plate) {
      plate.totalPrice = price
    }
  }

  return {
    isModelLoaded,
    isDetecting,
    currentDetections,
    faceDetections,
    plateDetections,
    selectedFaceId,
    totalAmount,
    latestFaceDetection,
    activePlates,
    setModelLoaded,
    setDetecting,
    addDetection,
    clearDetections,
    selectFace,
    updatePlatePrice
  }
})