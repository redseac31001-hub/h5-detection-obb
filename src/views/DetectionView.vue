<template>
  <div class="detection-view">
    <div class="header">
      <h1>餐厅AI识别系统</h1>
      <div class="header-controls">
        <el-button
          type="primary"
          @click="toggleDetection"
          :loading="isInitializing"
        >
          {{ detectionStore.isDetecting ? '停止检测' : '开始检测' }}
        </el-button>
        <router-link to="/face-payment">
          <el-button type="success">人脸支付</el-button>
        </router-link>
        <router-link to="/settings">
          <el-button>设置</el-button>
        </router-link>
      </div>
    </div>

    <div class="main-content">
      <div class="camera-section">
        <CameraView
          @frame-capture="onFrameCapture"
          @video-ready="onVideoReady"
        />
      </div>

      <div class="detection-panels">
        <div class="panel-tabs">
          <el-tabs v-model="activeTab" type="border-card">
            <el-tab-pane label="人脸检测" name="face">
              <FaceDetection
                :canvas-width="cameraStore.config.width"
                :canvas-height="cameraStore.config.height"
                :current-frame="currentFrame"
              />
            </el-tab-pane>
            
            <el-tab-pane label="餐盘识别" name="plate">
              <PlateDetection
                :canvas-width="cameraStore.config.width"
                :canvas-height="cameraStore.config.height"
                :current-frame="currentFrame"
              />
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </div>

    <div class="status-bar">
      <div class="status-item">
        <span class="label">模型状态:</span>
        <span :class="['status', { active: detectionStore.isModelLoaded }]">
          {{ detectionStore.isModelLoaded ? '已加载' : '未加载' }}
        </span>
      </div>
      
      <div class="status-item">
        <span class="label">检测状态:</span>
        <span :class="['status', { active: detectionStore.isDetecting }]">
          {{ detectionStore.isDetecting ? '运行中' : '已停止' }}
        </span>
      </div>
      
      <div class="status-item">
        <span class="label">FPS:</span>
        <span class="value">{{ fps.toFixed(1) }}</span>
      </div>
      
      <div class="status-item">
        <span class="label">检测数量:</span>
        <span class="value">{{ totalDetections }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useCameraStore } from '@/stores/camera'
import { useDetectionStore } from '@/stores/detection'
import { DetectionService } from '@/services/detectionService'
import CameraView from '@/components/CameraView.vue'
import FaceDetection from '@/components/FaceDetection.vue'
import PlateDetection from '@/components/PlateDetection.vue'
import type { VideoFrame, DetectionResult } from '@/types'

const cameraStore = useCameraStore()
const detectionStore = useDetectionStore()

const activeTab = ref('face')
const currentFrame = ref<VideoFrame>()
const detectionService = ref<DetectionService>()
const isInitializing = ref(false)
const fps = ref(0)
const frameCount = ref(0)
const lastFpsUpdate = ref(Date.now())

const totalDetections = computed(() => {
  return detectionStore.faceDetections.length + detectionStore.plateDetections.length
})

async function toggleDetection() {
  if (detectionStore.isDetecting) {
    stopDetection()
  } else {
    await startDetection()
  }
}

async function startDetection() {
  isInitializing.value = true
  
  try {
    if (!detectionService.value) {
      detectionService.value = new DetectionService()
    }
    
    const initialized = await detectionService.value.initialize()
    
    if (initialized) {
      detectionStore.setModelLoaded(true)
      detectionStore.setDetecting(true)
      console.log('检测服务启动成功')
    } else {
      throw new Error('检测服务初始化失败')
    }
  } catch (error) {
    console.error('启动检测失败:', error)
    ElMessage.error('启动检测失败，请检查模型文件')
  } finally {
    isInitializing.value = false
  }
}

function stopDetection() {
  detectionStore.setDetecting(false)
  console.log('检测服务已停止')
}

function onVideoReady(video: HTMLVideoElement) {
  console.log('视频流就绪:', video)
}

async function onFrameCapture(frame: VideoFrame) {
  currentFrame.value = frame
  updateFPS()
  
  if (detectionStore.isDetecting && detectionService.value) {
    await detectionService.value.detectObjects(frame)
  }
}

function updateFPS() {
  frameCount.value++
  const now = Date.now()
  const elapsed = now - lastFpsUpdate.value
  
  if (elapsed >= 1000) {
    fps.value = (frameCount.value * 1000) / elapsed
    frameCount.value = 0
    lastFpsUpdate.value = now
  }
}

// 监听检测完成事件
function onDetectionComplete(event: CustomEvent) {
  const { detections } = event.detail
  
  detections.forEach((detection: DetectionResult) => {
    detectionStore.addDetection(detection)
  })
}

onMounted(() => {
  window.addEventListener('detectionComplete', onDetectionComplete as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('detectionComplete', onDetectionComplete as EventListener)
  
  if (detectionService.value) {
    detectionService.value.dispose()
  }
  
  stopDetection()
})
</script>

<style scoped lang="less">
.detection-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  
  h1 {
    margin: 0;
    font-size: 24px;
    color: #333;
  }
  
  .header-controls {
    display: flex;
    gap: 12px;
  }
}

.main-content {
  display: flex;
  flex: 1;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
  
  .camera-section {
    flex: 1;
    min-width: 0;
  }
  
  .detection-panels {
    width: 400px;
    
    .panel-tabs {
      height: 100%;
      
      :deep(.el-tabs__content) {
        height: calc(100% - 40px);
        overflow: hidden;
      }
      
      :deep(.el-tab-pane) {
        height: 100%;
        overflow: hidden;
      }
    }
  }
}

.status-bar {
  display: flex;
  gap: 24px;
  padding: 12px 24px;
  background: #fff;
  border-top: 1px solid #e0e0e0;
  font-size: 14px;
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .label {
      color: #666;
    }
    
    .status {
      padding: 2px 8px;
      border-radius: 12px;
      background: #e0e0e0;
      color: #666;
      font-size: 12px;
      
      &.active {
        background: #4caf50;
        color: white;
      }
    }
    
    .value {
      font-weight: bold;
      color: #333;
    }
  }
}

@media (max-width: 1200px) {
  .main-content {
    flex-direction: column;
    
    .detection-panels {
      width: 100%;
      height: 300px;
    }
  }
}
</style>