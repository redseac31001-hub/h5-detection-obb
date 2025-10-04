<template>
  <div class="page-container">
    <header class="page-header">
      <h1>🍽️ AI对象检测</h1>
      <p>上传图片，系统将自动识别图中的物体</p>
    </header>

    <div class="main-layout">
      <!-- Left Column: Controls & Results -->
      <div class="left-column">
        <div class="control-card card">
          <div class="card-header"> 
            <h3>控制面板</h3>
            <div class="status-indicator" :class="statusClass">
              {{ statusMessage }}
            </div>
          </div>
          <div class="control-group">
            <label>置信度阈值</label>
            <input type="range" v-model.number="confidenceThreshold" min="0.1" max="0.9" step="0.05" />
            <span class="value-display">{{ confidenceThreshold.toFixed(2) }}</span>
          </div>
          <div class="control-group">
            <label>IoU 阈值 (NMS)</label>
            <input type="range" v-model.number="iouThreshold" min="0.1" max="0.9" step="0.05" />
            <span class="value-display">{{ iouThreshold.toFixed(2) }}</span>
          </div>
          <div class="button-group">
            <button @click="startDetection" :disabled="!isReady || isDetecting" class="btn btn-primary">
              {{ isDetecting ? '检测中...' : (isReady ? '重新检测' : '环境准备中...') }}
            </button>
            <button @click="selectImage" class="btn btn-secondary">选择图片</button>
            <input type="file" ref="fileInput" @change="onFileSelected" accept="image/*" style="display: none" />
          </div>
        </div>

        <div class="results-card card" v-if="detections.length > 0">
           <div class="card-header">
            <h3>检测结果</h3>
            <span class="detection-count">找到 {{ detections.length }} 个对象</span>
          </div>
          <ul class="detections-list">
            <li v-for="(det, i) in detections" :key="i" class="detection-item">
              <span class="class-name">{{ det.class }}</span>
              <span class="confidence">{{ (det.confidence * 100).toFixed(1) }}%</span>
            </li>
          </ul>
           <button @click="clearResults" class="btn btn-tertiary">清除结果</button>
        </div>
      </div>

      <!-- Right Column: Image -->
      <div class="right-column">
        <div class="image-card card">
          <div class="image-container">
            <img ref="testImage" :src="imageSrc" @load="onImageLoaded" alt="测试图片" />
            <canvas ref="detectionCanvas" class="detection-overlay"></canvas>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
    await modelManager.initialize(defaultModelConfig)
    isReady.value = modelManager.isReady()
    if (isReady.value) {
      statusMessage.value = 'AI环境已就绪'
    }
  } catch (error) {
    statusMessage.value = `初始化失败: ${error.message}`
  }
})

async function startDetection() {
  if (!isReady.value || !testImage.value || isDetecting.value) return

  isDetecting.value = true
  statusMessage.value = '正在检测...'
  try {
    const results = await modelManager.detectObjects(testImage.value, {
      confidenceThreshold: confidenceThreshold.value,
      iouThreshold: iouThreshold.value,
    })
    detections.value = results
    drawDetections(results)
    statusMessage.value = `检测完成`
  } catch (error) {
    statusMessage.value = `检测失败`
  } finally {
    isDetecting.value = false
  }
}

// --- 最终版绘制函数 ---
function drawDetections(results: Detection[]) {
  const img = testImage.value!;
  const canvas = detectionCanvas.value!;
  const ctx = canvas.getContext('2d')!;

  // 1. 将Canvas的绘图缓冲尺寸设置为图片的原始尺寸
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. 直接在与原图1:1的坐标系上绘制
  // CSS会将此Canvas与<img>以完全相同的方式进行缩放，从而保证对齐
  for (const { bbox, class: className, confidence } of results) {
    ctx.strokeStyle = '#16a34a'; // 使用明亮的绿色
    ctx.lineWidth = Math.max(2, canvas.width * 0.002); // 线条宽度自适应
    ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
    
    const fontSize = Math.max(14, canvas.width * 0.012);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const label = `${className} ${(confidence * 100).toFixed(1)}%`;
    const textWidth = ctx.measureText(label).width;
    
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(bbox.x - ctx.lineWidth / 2, bbox.y - (fontSize + 8), textWidth + 8, fontSize + 8);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, bbox.x + 4, bbox.y - 5);
  }
}

function onImageLoaded() {
  // 延迟一帧执行检测，确保浏览器完成图片渲染和尺寸计算
  requestAnimationFrame(() => {
    if(isReady.value) {
        startDetection();
    }
  });
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
/* --- 最终版UI样式：明亮、简洁、高对比度 --- */
.page-container {
  background-color: #f4f7f6;
  min-height: 100vh;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #2c3e50;
}

.page-header {
  text-align: center;
  margin-bottom: 2rem;
}

.page-header h1 { font-size: 2.5rem; font-weight: 700; }
.page-header p { font-size: 1.1rem; color: #5a6876; }

.main-layout {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 2rem;
}

.left-column, .right-column { display: flex; flex-direction: column; gap: 2rem; }

.card {
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0,0,0,0.05);
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.card-header h3 { font-size: 1.25rem; font-weight: 600; }

.status-indicator {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}
.status-loading { background-color: #e0f2fe; color: #0284c7; }
.status-success { background-color: #dcfce7; color: #16a34a; }

.control-group {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}
.control-group label { font-weight: 500; color: #5a6876; }
.value-display { font-weight: 500; font-family: monospace; }

input[type="range"] { accent-color: #3b82f6; }

.button-group { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem; }

.btn {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid transparent;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary { background-color: #3b82f6; color: white; }
.btn-primary:hover:not(:disabled) { background-color: #2563eb; }

.btn-secondary { background-color: #e5e7eb; color: #2c3e50; }
.btn-secondary:hover:not(:disabled) { background-color: #d1d5db; }

.btn-tertiary {
  width: 100%;
  margin-top: 1rem;
  background-color: transparent;
  color: #9ca3af;
  font-weight: 500;
  border: none;
}
.btn-tertiary:hover { color: #ef4444; background-color: #fee2e2; }

.results-card .detection-count { font-size: 0.875rem; font-weight: 500; color: #5a6876; }

.detections-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.detection-item { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-radius: 6px; background-color: #f8f9fa; }
.detection-item .class-name { font-weight: 600; }
.detection-item .confidence { font-weight: 500; color: #5a6876; }

.image-card { padding: 0.5rem; }
.image-container { position: relative; display: block; }
.image-container img { max-width: 100%; display: block; border-radius: 8px; }
.detection-overlay { position: absolute; top: 0; left: 0; pointer-events: none; }

/* Responsive Layout */
@media (max-width: 1024px) {
  .main-layout { grid-template-columns: 1fr; }
}
</style>