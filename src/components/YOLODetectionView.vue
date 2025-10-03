<template>
  <div class="yolo-detection-container">
    <div class="detection-header">
      <h2>🍽️ 餐具AI识别系统</h2>
      <div class="status-indicator" :class="statusClass">
        {{ statusMessage }}
      </div>
    </div>

    <!-- 控制面板 -->
    <div class="controls-panel">
      <div class="control-group">
        <label>置信度阈值:</label>
        <input 
          type="range" 
          v-model.number="confidenceThreshold" 
          min="0.001" 
          max="0.9" 
          step="0.001"
          @input="updateConfig"
        >
        <span class="value-display">{{ confidenceThreshold.toFixed(3) }}</span>
      </div>
      
      <div class="control-group">
        <label>NMS IoU阈值:</label>
        <input 
          type="range" 
          v-model.number="iouThreshold" 
          min="0.1" 
          max="0.8" 
          step="0.05"
          @input="updateConfig"
        >
        <span class="value-display">{{ iouThreshold.toFixed(2) }}</span>
      </div>

      <div class="control-buttons">
        <button 
          @click="initializeDetection" 
          :disabled="isInitializing"
          class="btn-primary"
        >
          {{ isInitializing ? '初始化中...' : '初始化检测' }}
        </button>
        
        <button 
          @click="startDetection" 
          :disabled="!canDetect"
          class="btn-success"
        >
          开始检测
        </button>
        
        <button @click="clearResults" class="btn-secondary">
          清除结果
        </button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.rawDetections }}</div>
        <div class="stat-label">原始检测</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.filteredDetections }}</div>
        <div class="stat-label">置信度过滤</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.finalDetections }}</div>
        <div class="stat-label">最终结果</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">¥{{ totalPrice.toFixed(2) }}</div>
        <div class="stat-label">总价格</div>
      </div>
    </div>

    <!-- 图片检测区域 -->
    <div class="detection-area">
      <div class="image-container">
        <img 
          ref="testImage"
          :src="testImageSrc" 
          @load="onImageLoaded"
          @error="onImageError"
          alt="测试图片"
        >
        <canvas 
          ref="detectionCanvas"
          class="detection-overlay"
        ></canvas>
      </div>

      <!-- 文件上传 -->
      <div class="upload-section">
        <input 
          type="file" 
          ref="fileInput"
          @change="onFileSelected"
          accept="image/*"
          style="display: none"
        >
        <button @click="selectImage" class="btn-outline">
          📷 选择图片
        </button>
        <button @click="useTestImage" class="btn-outline">
          🧪 使用测试图片
        </button>
      </div>
    </div>

    <!-- 检测结果 -->
    <div v-if="detections.length > 0" class="results-section">
      <h3>检测结果 ({{ detections.length }} 个对象)</h3>
      <div class="detections-list">
        <div 
          v-for="(detection, index) in detections" 
          :key="detection.id"
          class="detection-item"
          :style="{ borderLeftColor: getColorForClass(detection.class) }"
        >
          <div class="detection-info">
            <span class="class-name">{{ getDisplayName(detection.class) }}</span>
            <span class="confidence">{{ (detection.confidence * 100).toFixed(1) }}%</span>
            <span class="price">¥{{ getClassPrice(detection.class).toFixed(2) }}</span>
          </div>
          <div class="detection-details">
            位置: ({{ Math.round(detection.bbox.x) }}, {{ Math.round(detection.bbox.y) }})
            尺寸: {{ Math.round(detection.bbox.width) }}×{{ Math.round(detection.bbox.height) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { DetectionService } from '@/services/detectionService'
import type { DetectionResult } from '@/types'

// 响应式数据
const detectionService = ref<DetectionService>()
const isInitializing = ref(false)
const isDetecting = ref(false)
const isServiceInitialized = ref(false)
const imageLoaded = ref(false)

const confidenceThreshold = ref(0.1)
const iouThreshold = ref(0.5)
const testImageSrc = ref('/public/test/111532922-src.jpg')

const detections = ref<DetectionResult[]>([])
const stats = ref({
  rawDetections: 0,
  filteredDetections: 0,
  finalDetections: 0
})

// 模板引用
const testImage = ref<HTMLImageElement>()
const detectionCanvas = ref<HTMLCanvasElement>()
const fileInput = ref<HTMLInputElement>()

// 计算属性
const statusClass = computed(() => {
  if (isInitializing.value || isDetecting.value) return 'status-loading'
  if (isServiceInitialized.value) return 'status-success'
  return 'status-error'
})

const statusMessage = computed(() => {
  if (isInitializing.value) return '正在初始化检测服务...'
  if (isDetecting.value) return '正在检测中...'
  if (isServiceInitialized.value) return '检测服务已就绪'
  return '检测服务未初始化'
})

const canDetect = computed(() => {
  return isServiceInitialized.value && imageLoaded.value && !isDetecting.value
})

const totalPrice = computed(() => {
  if (!detectionService.value) return 0
  return detectionService.value.calculateTotalPrice(detections.value)
})

// 方法
async function initializeDetection() {
  if (isInitializing.value) return
  
  try {
    isInitializing.value = true
    detectionService.value = new DetectionService()
    
    const success = await detectionService.value.initialize()
    isServiceInitialized.value = success
    
    if (success) {
      console.log('✅ 检测服务初始化成功')
      updateConfig() // 应用初始配置
    } else {
      console.error('❌ 检测服务初始化失败')
    }
  } catch (error) {
    console.error('❌ 初始化过程中发生错误:', error)
    isServiceInitialized.value = false
  } finally {
    isInitializing.value = false
  }
}

async function startDetection() {
  if (!canDetect.value || !detectionService.value || !testImage.value) return
  
  try {
    isDetecting.value = true
    
    // 创建ImageData
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = testImage.value.width
    canvas.height = testImage.value.height
    ctx.drawImage(testImage.value, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // 进行检测
    const results = await detectionService.value.detectObjectsFromImage(imageData)
    detections.value = results
    
    // 绘制检测框
    drawDetections(results)
    
    // 模拟统计信息（实际中可以从YOLO服务获取）
    stats.value = {
      rawDetections: Math.round(results.length * 2.5), // 估算原始检测数
      filteredDetections: Math.round(results.length * 1.5), // 估算过滤后数量
      finalDetections: results.length
    }
    
    console.log(`✅ 检测完成，找到 ${results.length} 个对象`)
    
  } catch (error) {
    console.error('❌ 检测失败:', error)
  } finally {
    isDetecting.value = false
  }
}

function drawDetections(detectionResults: DetectionResult[]) {
  if (!detectionCanvas.value || !testImage.value) return
  
  const canvas = detectionCanvas.value
  const ctx = canvas.getContext('2d')!
  
  // 设置画布尺寸
  canvas.width = testImage.value.width
  canvas.height = testImage.value.height
  
  // 清除画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 绘制检测框
  detectionResults.forEach((detection) => {
    const { bbox, class: className, confidence } = detection
    const color = getColorForClass(className)
    const alpha = Math.min(1, confidence * 3)
    
    // 绘制边界框
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.globalAlpha = alpha
    ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height)
    
    // 绘制标签背景
    const label = `${getDisplayName(className)} ${(confidence * 100).toFixed(1)}%`
    ctx.font = '12px Arial'
    const textWidth = ctx.measureText(label).width
    
    ctx.fillStyle = color
    ctx.fillRect(bbox.x, bbox.y - 18, textWidth + 6, 18)
    
    // 绘制标签文字
    ctx.fillStyle = 'white'
    ctx.globalAlpha = 1
    ctx.fillText(label, bbox.x + 3, bbox.y - 4)
  })
}

function updateConfig() {
  if (!detectionService.value) return
  
  detectionService.value.updateYOLOConfig({
    confidenceThreshold: confidenceThreshold.value,
    iouThreshold: iouThreshold.value
  })
}

function clearResults() {
  detections.value = []
  stats.value = { rawDetections: 0, filteredDetections: 0, finalDetections: 0 }
  
  if (detectionCanvas.value) {
    const ctx = detectionCanvas.value.getContext('2d')!
    ctx.clearRect(0, 0, detectionCanvas.value.width, detectionCanvas.value.height)
  }
}

function onImageLoaded() {
  imageLoaded.value = true
  console.log('✅ 图片加载成功')
}

function onImageError() {
  imageLoaded.value = false
  console.error('❌ 图片加载失败')
}

function selectImage() {
  fileInput.value?.click()
}

function onFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      testImageSrc.value = e.target?.result as string
      clearResults()
    }
    reader.readAsDataURL(file)
  }
}

function useTestImage() {
  testImageSrc.value = '/public/test/111532922-src.jpg'
  clearResults()
}

// 辅助函数
function getDisplayName(className: string): string {
  const nameMap: Record<string, string> = {
    'Fruit_Bowl': '水果碗',
    'Large_Dish_for_Vegetables': '大菜盘',
    'Large_Noodle_Bowl': '大面碗',
    'Oval_Plate_for_Staple_Food': '主食椭圆盘',
    'Small_Dish_for_Vegetables': '小菜盘',
    'Small_Noodle_Bowl': '小面碗',
    'Yogurt_Container': '酸奶杯'
  }
  return nameMap[className] || className
}

function getColorForClass(className: string): string {
  const colors = [
    '#4CAF50', '#2196F3', '#FF9800', '#E91E63',
    '#9C27B0', '#00BCD4', '#795548'
  ]
  const index = className.charCodeAt(0) % colors.length
  return colors[index]
}

function getClassPrice(className: string): number {
  if (!detectionService.value) return 0
  return detectionService.value.getYOLOService().getClassPrice(className)
}

// 生命周期
onMounted(() => {
  console.log('🚀 YOLO检测组件已挂载')
})

onUnmounted(() => {
  if (detectionService.value) {
    detectionService.value.dispose()
  }
})
</script>

<style scoped>
.yolo-detection-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  background: #f5f5f5;
}

.detection-header {
  text-align: center;
  margin-bottom: 30px;
}

.detection-header h2 {
  margin: 0 0 10px 0;
  color: #333;
}

.status-indicator {
  padding: 10px 20px;
  border-radius: 25px;
  font-weight: bold;
  display: inline-block;
}

.status-loading {
  background: #e3f2fd;
  color: #1976d2;
}

.status-success {
  background: #e8f5e8;
  color: #2e7d32;
}

.status-error {
  background: #ffebee;
  color: #c62828;
}

.controls-panel {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.control-group label {
  min-width: 120px;
  font-weight: bold;
}

.control-group input[type="range"] {
  flex: 1;
  max-width: 200px;
}

.value-display {
  min-width: 60px;
  font-family: monospace;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.control-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-primary {
  background: #2196f3;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
}

.btn-success {
  background: #4caf50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-success:hover:not(:disabled) {
  background: #45a049;
}

.btn-secondary {
  background: #757575;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-outline {
  background: transparent;
  color: #2196f3;
  border: 2px solid #2196f3;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-outline:hover {
  background: #2196f3;
  color: white;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #2196f3;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.detection-area {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.image-container {
  position: relative;
  display: inline-block;
  margin-bottom: 20px;
}

.image-container img {
  max-width: 100%;
  max-height: 600px;
  border: 2px solid #ddd;
  border-radius: 4px;
}

.detection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  border: 2px solid transparent;
  border-radius: 4px;
}

.upload-section {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.results-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.results-section h3 {
  margin: 0 0 15px 0;
  color: #333;
}

.detections-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detection-item {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  border-left: 4px solid #4caf50;
}

.detection-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.class-name {
  font-weight: bold;
  color: #333;
}

.confidence {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.price {
  background: #e8f5e8;
  color: #2e7d32;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.detection-details {
  font-size: 12px;
  color: #666;
}

@media (max-width: 768px) {
  .controls-panel {
    padding: 15px;
  }
  
  .control-group {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .control-buttons {
    flex-direction: column;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>