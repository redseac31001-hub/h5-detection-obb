<template>
  <div class="camera-view">
    <div class="camera-container">
      <video
        ref="videoRef"
        :width="cameraStore.config.width"
        :height="cameraStore.config.height"
        autoplay
        muted
        playsinline
        @loadedmetadata="onVideoLoaded"
      />
      <canvas
        ref="canvasRef"
        :width="cameraStore.config.width"
        :height="cameraStore.config.height"
        class="detection-overlay"
      />
    </div>
    
    <div class="controls">
      <el-button 
        type="primary" 
        @click="toggleCamera"
        :loading="loading"
      >
        {{ cameraStore.isStreaming ? '停止摄像头' : '启动摄像头' }}
      </el-button>
      
      <el-button 
        @click="switchCamera"
        :disabled="!cameraStore.isStreaming || cameraStore.devices.length <= 1"
      >
        切换摄像头
      </el-button>
      
      <el-button 
        @click="captureFrame"
        :disabled="!cameraStore.isStreaming"
      >
        捕获帧
      </el-button>
    </div>

    <div class="info-panel">
      <div class="status">
        <span :class="{ active: cameraStore.isStreaming }">
          摄像头状态: {{ cameraStore.isStreaming ? '运行中' : '已停止' }}
        </span>
        <span :class="{ active: detectionStore.isDetecting }">
          检测状态: {{ detectionStore.isDetecting ? '检测中' : '未检测' }}
        </span>
      </div>
      
      <div class="detection-stats">
        <span>人脸数量: {{ detectionStore.faceDetections.length }}</span>
        <span>餐盘数量: {{ detectionStore.activePlates.length }}</span>
        <span>总金额: ¥{{ detectionStore.totalAmount.toFixed(2) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useCameraStore } from '@/stores/camera'
import { useDetectionStore } from '@/stores/detection'
import type { VideoFrame } from '@/types'

const emit = defineEmits<{
  frameCapture: [frame: VideoFrame]
  videoReady: [video: HTMLVideoElement]
}>()

const cameraStore = useCameraStore()
const detectionStore = useDetectionStore()

const videoRef = ref<HTMLVideoElement>()
const canvasRef = ref<HTMLCanvasElement>()
const loading = ref(false)

let animationId: number

async function toggleCamera() {
  loading.value = true
  try {
    if (cameraStore.isStreaming) {
      cameraStore.stopStream()
    } else {
      await cameraStore.getDevices()
      await cameraStore.startStream()
      await nextTick()
      if (videoRef.value && cameraStore.stream) {
        videoRef.value.srcObject = cameraStore.stream
      }
    }
  } catch (error) {
    console.error('摄像头操作失败:', error)
  } finally {
    loading.value = false
  }
}

async function switchCamera() {
  try {
    await cameraStore.switchCamera()
    await nextTick()
    if (videoRef.value && cameraStore.stream) {
      videoRef.value.srcObject = cameraStore.stream
    }
  } catch (error) {
    console.error('切换摄像头失败:', error)
  }
}

function onVideoLoaded() {
  if (videoRef.value) {
    emit('videoReady', videoRef.value)
    startFrameCapture()
  }
}

function startFrameCapture() {
  if (!videoRef.value || !canvasRef.value) return
  
  const captureLoop = () => {
    if (cameraStore.isStreaming && videoRef.value && canvasRef.value) {
      const canvas = canvasRef.value
      const ctx = canvas.getContext('2d')
      
      if (ctx && videoRef.value.readyState === 4) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)
        
        const frame: VideoFrame = {
          canvas: canvas,
          timestamp: Date.now(),
          width: canvas.width,
          height: canvas.height
        }
        
        emit('frameCapture', frame)
      }
    }
    
    animationId = requestAnimationFrame(captureLoop)
  }
  
  captureLoop()
}

function captureFrame() {
  if (videoRef.value && canvasRef.value) {
    const canvas = canvasRef.value
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)
      
      // 下载捕获的帧
      const link = document.createElement('a')
      link.download = `frame_${Date.now()}.png`
      link.href = canvas.toDataURL()
      link.click()
    }
  }
}

onMounted(async () => {
  await cameraStore.getDevices()
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  cameraStore.stopStream()
})
</script>

<style scoped lang="less">
.camera-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.camera-container {
  position: relative;
  display: inline-block;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  
  video {
    display: block;
    background: #000;
  }
  
  .detection-overlay {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 1;
  }
}

.controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.info-panel {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  
  .status {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
    
    span {
      padding: 4px 8px;
      border-radius: 4px;
      background: #e0e0e0;
      color: #666;
      font-size: 12px;
      
      &.active {
        background: #4caf50;
        color: white;
      }
    }
  }
  
  .detection-stats {
    display: flex;
    gap: 16px;
    font-size: 14px;
    color: #333;
  }
}
</style>