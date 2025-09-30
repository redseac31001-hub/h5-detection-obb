<template>
  <div class="settings-view">
    <div class="header">
      <h1>系统设置</h1>
      <router-link to="/">
        <el-button>返回主页</el-button>
      </router-link>
    </div>

    <div class="settings-content">
      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="摄像头设置" name="camera">
          <div class="settings-section">
            <h3>摄像头配置</h3>
            
            <el-form label-width="120px">
              <el-form-item label="设备选择:">
                <el-select
                  v-model="cameraStore.currentDevice"
                  placeholder="选择摄像头设备"
                  @change="onDeviceChange"
                  style="width: 300px;"
                >
                  <el-option
                    v-for="device in cameraStore.devices"
                    :key="device.deviceId"
                    :label="device.label || `摄像头 ${device.deviceId.slice(0, 8)}`"
                    :value="device.deviceId"
                  />
                </el-select>
                <el-button @click="refreshDevices" style="margin-left: 12px;">
                  刷新设备
                </el-button>
              </el-form-item>
              
              <el-form-item label="分辨率:">
                <el-select
                  v-model="selectedResolution"
                  @change="onResolutionChange"
                  style="width: 200px;"
                >
                  <el-option label="640x480" value="640x480" />
                  <el-option label="1280x720" value="1280x720" />
                  <el-option label="1920x1080" value="1920x1080" />
                </el-select>
              </el-form-item>
              
              <el-form-item label="摄像头方向:">
                <el-radio-group
                  v-model="cameraStore.config.facingMode"
                  @change="onFacingModeChange"
                >
                  <el-radio value="user">前置摄像头</el-radio>
                  <el-radio value="environment">后置摄像头</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="检测设置" name="detection">
          <div class="settings-section">
            <h3>检测参数</h3>
            
            <el-form label-width="150px">
              <el-form-item label="人脸检测阈值:">
                <el-slider
                  v-model="faceThreshold"
                  :min="0.1"
                  :max="1.0"
                  :step="0.05"
                  show-input
                  style="width: 300px;"
                />
              </el-form-item>
              
              <el-form-item label="餐盘检测阈值:">
                <el-slider
                  v-model="plateThreshold"
                  :min="0.1"
                  :max="1.0"
                  :step="0.05"
                  show-input
                  style="width: 300px;"
                />
              </el-form-item>
              
              <el-form-item label="最大检测数量:">
                <el-input-number
                  v-model="maxDetections"
                  :min="1"
                  :max="50"
                  style="width: 200px;"
                />
              </el-form-item>
              
              <el-form-item label="检测间隔(ms):">
                <el-input-number
                  v-model="detectionInterval"
                  :min="100"
                  :max="2000"
                  :step="100"
                  style="width: 200px;"
                />
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="模型设置" name="model">
          <div class="settings-section">
            <h3>AI模型配置</h3>
            
            <el-form label-width="150px">
              <el-form-item label="人脸模型路径:">
                <el-input
                  v-model="faceModelPath"
                  placeholder="输入人脸检测模型URL"
                  style="width: 400px;"
                />
                <el-button @click="testModel('face')" style="margin-left: 12px;">
                  测试模型
                </el-button>
              </el-form-item>
              
              <el-form-item label="餐盘模型路径:">
                <el-input
                  v-model="plateModelPath"
                  placeholder="输入餐盘检测模型URL"
                  style="width: 400px;"
                />
                <el-button @click="testModel('plate')" style="margin-left: 12px;">
                  测试模型
                </el-button>
              </el-form-item>
              
              <el-form-item label="模型输入尺寸:">
                <el-select v-model="modelInputSize" style="width: 200px;">
                  <el-option label="416" :value="416" />
                  <el-option label="512" :value="512" />
                  <el-option label="640" :value="640" />
                  <el-option label="832" :value="832" />
                </el-select>
              </el-form-item>
            </el-form>
            
            <div class="model-status">
              <h4>模型状态</h4>
              <div class="status-grid">
                <div class="status-item">
                  <span class="label">人脸模型:</span>
                  <span :class="['status', { loaded: detectionStore.isModelLoaded }]">
                    {{ detectionStore.isModelLoaded ? '已加载' : '未加载' }}
                  </span>
                </div>
                <div class="status-item">
                  <span class="label">餐盘模型:</span>
                  <span :class="['status', { loaded: detectionStore.isModelLoaded }]">
                    {{ detectionStore.isModelLoaded ? '已加载' : '未加载' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="系统信息" name="system">
          <div class="settings-section">
            <h3>系统信息</h3>
            
            <div class="info-grid">
              <div class="info-item">
                <span class="label">浏览器:</span>
                <span class="value">{{ browserInfo.name }} {{ browserInfo.version }}</span>
              </div>
              
              <div class="info-item">
                <span class="label">操作系统:</span>
                <span class="value">{{ browserInfo.os }}</span>
              </div>
              
              <div class="info-item">
                <span class="label">TensorFlow.js版本:</span>
                <span class="value">{{ tfVersion }}</span>
              </div>
              
              <div class="info-item">
                <span class="label">WebGL支持:</span>
                <span class="value">{{ webglSupported ? '是' : '否' }}</span>
              </div>
              
              <div class="info-item">
                <span class="label">摄像头权限:</span>
                <span class="value">{{ cameraPermission }}</span>
              </div>
            </div>
            
            <div class="system-actions">
              <el-button @click="clearCache">清除缓存</el-button>
              <el-button @click="exportSettings">导出设置</el-button>
              <el-button @click="importSettings">导入设置</el-button>
              <el-button type="danger" @click="resetSettings">重置设置</el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCameraStore } from '@/stores/camera'
import { useDetectionStore } from '@/stores/detection'
import * as tf from '@tensorflow/tfjs'

const cameraStore = useCameraStore()
const detectionStore = useDetectionStore()

const activeTab = ref('camera')

// 摄像头设置
const selectedResolution = ref('640x480')

// 检测设置
const faceThreshold = ref(0.5)
const plateThreshold = ref(0.6)
const maxDetections = ref(10)
const detectionInterval = ref(500)

// 模型设置
const faceModelPath = ref('/models/face_detection_model/model.json')
const plateModelPath = ref('/models/plate_detection_model/model.json')
const modelInputSize = ref(640)

// 系统信息
const tfVersion = ref('')
const webglSupported = ref(false)
const cameraPermission = ref('未知')

const browserInfo = computed(() => {
  const ua = navigator.userAgent
  const browser = {
    name: 'Unknown',
    version: 'Unknown',
    os: 'Unknown'
  }
  
  // 检测浏览器
  if (ua.includes('Chrome')) {
    browser.name = 'Chrome'
    const match = ua.match(/Chrome\/(\d+)/)
    if (match) browser.version = match[1]
  } else if (ua.includes('Firefox')) {
    browser.name = 'Firefox'
    const match = ua.match(/Firefox\/(\d+)/)
    if (match) browser.version = match[1]
  } else if (ua.includes('Safari')) {
    browser.name = 'Safari'
    const match = ua.match(/Version\/(\d+)/)
    if (match) browser.version = match[1]
  }
  
  // 检测操作系统
  if (ua.includes('Windows')) browser.os = 'Windows'
  else if (ua.includes('Mac')) browser.os = 'macOS'
  else if (ua.includes('Linux')) browser.os = 'Linux'
  else if (ua.includes('Android')) browser.os = 'Android'
  else if (ua.includes('iOS')) browser.os = 'iOS'
  
  return browser
})

async function refreshDevices() {
  try {
    await cameraStore.getDevices()
    ElMessage.success('设备列表已更新')
  } catch (_error) {
    ElMessage.error('获取设备列表失败')
  }
}

async function onDeviceChange(deviceId: string) {
  if (cameraStore.isStreaming) {
    try {
      await cameraStore.startStream(deviceId)
      ElMessage.success('摄像头切换成功')
    } catch (_error) {
      ElMessage.error('摄像头切换失败')
    }
  }
}

function onResolutionChange(resolution: string) {
  const [width, height] = resolution.split('x').map(Number)
  cameraStore.updateConfig({ width, height })
  
  if (cameraStore.isStreaming) {
    ElMessage.info('分辨率将在下次启动摄像头时生效')
  }
}

function onFacingModeChange() {
  if (cameraStore.isStreaming) {
    ElMessage.info('摄像头方向将在下次启动时生效')
  }
}

async function testModel(type: 'face' | 'plate') {
  const modelPath = type === 'face' ? faceModelPath.value : plateModelPath.value
  
  try {
    ElMessage.info('正在测试模型连接...')
    
    // 尝试加载模型
    const model = await tf.loadGraphModel(modelPath)
    model.dispose()
    
    ElMessage.success('模型连接测试成功')
  } catch (error) {
    ElMessage.error(`模型连接测试失败: ${error}`)
  }
}

function clearCache() {
  // 清除浏览器缓存
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name)
      })
    })
  }
  
  localStorage.clear()
  sessionStorage.clear()
  
  ElMessage.success('缓存已清除')
}

function exportSettings() {
  const settings = {
    camera: {
      resolution: selectedResolution.value,
      facingMode: cameraStore.config.facingMode
    },
    detection: {
      faceThreshold: faceThreshold.value,
      plateThreshold: plateThreshold.value,
      maxDetections: maxDetections.value,
      detectionInterval: detectionInterval.value
    },
    model: {
      faceModelPath: faceModelPath.value,
      plateModelPath: plateModelPath.value,
      inputSize: modelInputSize.value
    }
  }
  
  const blob = new Blob([JSON.stringify(settings, null, 2)], {
    type: 'application/json'
  })
  
  const link = document.createElement('a')
  link.download = 'restaurant-ai-settings.json'
  link.href = URL.createObjectURL(blob)
  link.click()
  
  ElMessage.success('设置已导出')
}

function importSettings() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target?.result as string)
        
        // 应用设置
        if (settings.camera) {
          selectedResolution.value = settings.camera.resolution || '640x480'
          cameraStore.updateConfig({ facingMode: settings.camera.facingMode || 'environment' })
        }
        
        if (settings.detection) {
          faceThreshold.value = settings.detection.faceThreshold || 0.5
          plateThreshold.value = settings.detection.plateThreshold || 0.6
          maxDetections.value = settings.detection.maxDetections || 10
          detectionInterval.value = settings.detection.detectionInterval || 500
        }
        
        if (settings.model) {
          faceModelPath.value = settings.model.faceModelPath || '/models/face_detection_model/model.json'
          plateModelPath.value = settings.model.plateModelPath || '/models/plate_detection_model/model.json'
          modelInputSize.value = settings.model.inputSize || 640
        }
        
        ElMessage.success('设置已导入')
      } catch (_error) {
        ElMessage.error('设置文件格式错误')
      }
    }
    
    reader.readAsText(file)
  }
  
  input.click()
}

function resetSettings() {
  ElMessageBox.confirm('确定要重置所有设置吗？', '确认重置', {
    type: 'warning'
  }).then(() => {
    // 重置为默认值
    selectedResolution.value = '640x480'
    cameraStore.updateConfig({
      width: 640,
      height: 480,
      facingMode: 'environment'
    })
    
    faceThreshold.value = 0.5
    plateThreshold.value = 0.6
    maxDetections.value = 10
    detectionInterval.value = 500
    
    faceModelPath.value = '/models/face_detection_model/model.json'
    plateModelPath.value = '/models/plate_detection_model/model.json'
    modelInputSize.value = 640
    
    ElMessage.success('设置已重置')
  }).catch(() => {
    // 取消重置
  })
}

async function checkSystemInfo() {
  // 检查TensorFlow.js版本
  tfVersion.value = tf.version.tfjs
  
  // 检查WebGL支持
  try {
    await tf.ready()
    webglSupported.value = tf.getBackend() === 'webgl'
  } catch {
    webglSupported.value = false
  }
  
  // 检查摄像头权限
  try {
    const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName })
    cameraPermission.value = permissions.state
  } catch {
    cameraPermission.value = '不支持'
  }
}

onMounted(async () => {
  await cameraStore.getDevices()
  await checkSystemInfo()
  
  // 初始化分辨率设置
  const { width, height } = cameraStore.config
  selectedResolution.value = `${width}x${height}`
})
</script>

<style scoped lang="less">
.settings-view {
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
  
  h1 {
    margin: 0;
    color: #333;
  }
}

.settings-content {
  flex: 1;
  padding: 24px;
  overflow: auto;
  
  .settings-section {
    h3 {
      margin: 0 0 20px 0;
      color: #333;
      font-size: 18px;
    }
    
    .model-status {
      margin-top: 32px;
      
      h4 {
        margin: 0 0 16px 0;
        color: #333;
      }
      
      .status-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        
        .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
          
          .status {
            padding: 4px 12px;
            border-radius: 12px;
            background: #e0e0e0;
            color: #666;
            font-size: 12px;
            
            &.loaded {
              background: #4caf50;
              color: white;
            }
          }
        }
      }
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 32px;
      
      .info-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: #f9f9f9;
        border-radius: 6px;
        
        .label {
          color: #666;
        }
        
        .value {
          font-weight: bold;
          color: #333;
        }
      }
    }
    
    .system-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
  }
}

:deep(.el-tabs__content) {
  padding: 20px 0;
}

:deep(.el-form-item) {
  margin-bottom: 24px;
}
</style>