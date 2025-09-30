import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { CameraConfig } from '@/types'

export const useCameraStore = defineStore('camera', () => {
  const stream = shallowRef<MediaStream>()
  const devices = ref<MediaDeviceInfo[]>([])
  const currentDevice = ref<string>()
  const isStreaming = ref(false)
  const config = ref<CameraConfig>({
    width: 640,
    height: 480,
    facingMode: 'environment'
  })

  async function getDevices() {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices()
      devices.value = deviceList.filter(device => device.kind === 'videoinput')
      return devices.value
    } catch (error) {
      console.error('获取设备列表失败:', error)
      return []
    }
  }

  async function startStream(deviceId?: string) {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: config.value.width },
          height: { ideal: config.value.height },
          facingMode: config.value.facingMode
        },
        audio: false
      }

      if (stream.value) {
        stopStream()
      }

      stream.value = await navigator.mediaDevices.getUserMedia(constraints)
      currentDevice.value = deviceId
      isStreaming.value = true
      
      return stream.value
    } catch (error) {
      console.error('启动摄像头失败:', error)
      throw error
    }
  }

  function stopStream() {
    if (stream.value) {
      stream.value.getTracks().forEach(track => track.stop())
      stream.value = undefined
      isStreaming.value = false
    }
  }

  function updateConfig(newConfig: Partial<CameraConfig>) {
    config.value = { ...config.value, ...newConfig }
  }

  function switchCamera() {
    const currentIndex = devices.value.findIndex(d => d.deviceId === currentDevice.value)
    const nextIndex = (currentIndex + 1) % devices.value.length
    const nextDevice = devices.value[nextIndex]
    
    if (nextDevice) {
      return startStream(nextDevice.deviceId)
    }
  }

  return {
    stream,
    devices,
    currentDevice,
    isStreaming,
    config,
    getDevices,
    startStream,
    stopStream,
    updateConfig,
    switchCamera
  }
})