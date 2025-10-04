<template>
  <div class="yolo-detection-container">
    <div class="detection-header">
      <h2>🍽️ 餐具AI识别系统 (可配置版)</h2>
      <div class="status-indicator" :class="statusClass">
        {{ statusMessage }}
      </div>
    </div>

    <div class="controls-panel">
      <div class="control-group">
        <label>置信度阈值</label>
        <input type="range" v-model.number="confidenceThreshold" min="0.1" max="0.9" step="0.05" />
        <span>{{ confidenceThreshold.toFixed(2) }}</span>
      </div>
      <div class="control-group">
        <label>IoU 阈值 (NMS)</label>
        <input type="range" v-model.number="iouThreshold" min="0.1" max="0.9" step="0.05" />
        <span>{{ iouThreshold.toFixed(2) }}</span>
      </div>
      <div class="control-buttons">
        <button @click="startDetection" :disabled="!isReady || isDetecting" class="btn-success">
          {{ isDetecting ? '检测中...' : (isReady ? '开始检测' : '环境准备中...') }}
        </button>
        <button @click="selectImage" class="btn-outline">📷 选择图片</button>
        <button @click="clearResults" class="btn-secondary">清除结果</button>
        <input type="file" ref="fileInput" @change="onFileSelected" accept="image/*" style="display: none" />
      </div>
    </div>

    <div class="detection-area">
      <div class="image-container">
        <img ref="testImage" :src="imageSrc" @load="onImageLoaded" alt="测试图片" />
        <canvas ref="detectionCanvas" class="detection-overlay"></canvas>
      </div>
    </div>

    <div v-if="detections.length > 0" class="results-section">
      <h3>检测到 {{ detections.length }} 个对象</h3>
      <div class="detections-list">
        <div v-for="(det, i) in detections" :key="i" class="detection-item">
          <span class="class-name">{{ det.class }}</span>
          <span class="confidence">{{ (det.confidence * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
// 1. 导入新的模型管理器和配置
import { modelManager } from '@/services/tfModelManager'
import { defaultModelConfig } from '@/models.config'
import type { Detection } from '@/services/tfModelManager'

const isReady = ref(false)
const isDetecting = ref(false)
const statusMessage = ref('等待初始化...')
const imageSrc = ref('/test/111532922-src.jpg')
const detections = ref<Detection[]>([])

const confidenceThreshold = ref(0.4)
const iouThreshold = ref(0.5)

const testImage = ref<HTMLImageElement>()
const detectionCanvas = ref<HTMLCanvasElement>()
const fileInput = ref<HTMLInputElement>()

const statusClass = computed(() => {
  if (isDetecting.value || !isReady.value) return 'status-loading'
  return 'status-success'
})

onMounted(async () => {
  statusMessage.value = '正在初始化AI环境...'
  try {
    // 2. 使用默认配置初始化模型管理器
    await modelManager.initialize(defaultModelConfig)
    isReady.value = modelManager.isReady()
    if (isReady.value) {
      statusMessage.value = 'AI环境已就绪'
      console.log('✅ 可配置的ModelManager初始化成功')
    }
  } catch (error) {
    statusMessage.value = `初始化失败: ${error.message}`
    console.error('❌ 初始化失败:', error)
  }
})

async function startDetection() {
  if (!isReady.value || !testImage.value || isDetecting.value) return

  isDetecting.value = true
  statusMessage.value = '正在检测...'
  try {
    // 3. 调用模型管理器的检测方法
    const results = await modelManager.detectObjects(testImage.value, {
      confidenceThreshold: confidenceThreshold.value,
      iouThreshold: iouThreshold.value,
    })
    detections.value = results
    drawDetections(results)
    statusMessage.value = `检测完成，找到 ${results.length} 个对象`
  } catch (error) {
    statusMessage.value = `检测失败: ${error.message}`
    console.error('❌ 检测失败:', error)
  } finally {
    isDetecting.value = false
  }
}

function drawDetections(results: Detection[]) {
  const img = testImage.value!
  const canvas = detectionCanvas.value!
  const ctx = canvas.getContext('2d')!
  canvas.width = img.width
  canvas.height = img.height
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (const { bbox, class: className, confidence } of results) {
    ctx.strokeStyle = '#00FF00'
    ctx.lineWidth = 2
    ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height)
    ctx.fillStyle = '#00FF00'
    const label = `${className} ${(confidence * 100).toFixed(1)}%`
    ctx.fillText(label, bbox.x, bbox.y > 10 ? bbox.y - 5 : 10)
  }
}

function onImageLoaded() {
  console.log('✅ 图片已加载')
}

function selectImage() {
  fileInput.value?.click()
}

function onFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    imageSrc.value = URL.createObjectURL(file)
  }
}

function clearResults() {
  detections.value = []
  if (detectionCanvas.value) {
    const ctx = detectionCanvas.value.getContext('2d')!
    ctx.clearRect(0, 0, detectionCanvas.value.width, detectionCanvas.value.height)
  }
}
</script>

<style scoped>
/* 样式与之前保持一致 */
.yolo-detection-container { max-width: 800px; margin: auto; padding: 20px; font-family: sans-serif; }
.detection-header { text-align: center; margin-bottom: 20px; }
.status-indicator { padding: 8px; border-radius: 4px; display: inline-block; font-weight: bold; }
.status-loading { background: #e3f2fd; color: #1976d2; }
.status-success { background: #e8f5e8; color: #2e7d32; }
.controls-panel { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
.control-group { display: flex; align-items: center; gap: 15px; margin-bottom: 10px; }
.control-buttons { display: flex; gap: 10px; justify-content: center; margin-top: 15px; }
.btn-success, .btn-secondary, .btn-outline { border: 1px solid; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }
.btn-success { background: #4caf50; color: white; border-color: #4caf50; }
.btn-secondary { background: #757575; color: white; border-color: #757575; }
.btn-outline { background: transparent; color: #2196f3; border-color: #2196f3; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.detection-area { text-align: center; }
.image-container { position: relative; display: inline-block; }
.image-container img { max-width: 100%; border: 1px solid #ddd; }
.detection-overlay { position: absolute; top: 0; left: 0; pointer-events: none; }
.results-section { margin-top: 20px; }
.detections-list { display: flex; flex-direction: column; gap: 5px; }
.detection-item { background: #f8f9fa; padding: 10px; border-radius: 4px; display: flex; justify-content: space-between; }
</style>