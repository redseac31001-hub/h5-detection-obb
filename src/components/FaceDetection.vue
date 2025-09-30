<template>
  <div class="face-detection">
    <div class="detection-overlay">
      <svg
        :width="canvasWidth"
        :height="canvasHeight"
        class="annotation-svg"
      >
        <g v-for="face in visibleFaces" :key="face.id">
          <!-- 人脸边界框 -->
          <rect
            :x="face.bbox.x"
            :y="face.bbox.y"
            :width="face.bbox.width"
            :height="face.bbox.height"
            :class="[
              'face-bbox',
              { selected: selectedFaceId === face.faceId }
            ]"
            @click="selectFace(face)"
          />
          
          <!-- 置信度标签 -->
          <text
            :x="face.bbox.x"
            :y="face.bbox.y - 5"
            class="confidence-label"
          >
            Face: {{ (face.confidence * 100).toFixed(1) }}%
          </text>
          
          <!-- 人脸ID标签 -->
          <text
            v-if="face.faceId"
            :x="face.bbox.x"
            :y="face.bbox.y + face.bbox.height + 15"
            class="face-id-label"
          >
            ID: {{ face.faceId }}
          </text>
          
          <!-- 关键点标注 -->
          <g v-if="face.landmarks && showLandmarks">
            <circle
              v-for="(point, index) in face.landmarks"
              :key="index"
              :cx="point.x"
              :cy="point.y"
              r="2"
              class="landmark-point"
            />
          </g>
        </g>
      </svg>
    </div>

    <div class="face-panel">
      <div class="panel-header">
        <h3>人脸检测</h3>
        <div class="controls">
          <el-checkbox v-model="showLandmarks">显示关键点</el-checkbox>
          <el-checkbox v-model="enableTracking">启用追踪</el-checkbox>
        </div>
      </div>

      <div class="face-list">
        <div
          v-for="face in recentFaces"
          :key="face.id"
          :class="[
            'face-item',
            { active: selectedFaceId === face.faceId }
          ]"
          @click="selectFace(face)"
        >
          <div class="face-thumbnail">
            <canvas
              :ref="el => setThumbnailCanvas(face.id, el as HTMLCanvasElement)"
              width="60"
              height="60"
            />
          </div>
          
          <div class="face-info">
            <div class="face-id">{{ face.faceId || '未识别' }}</div>
            <div class="confidence">{{ (face.confidence * 100).toFixed(1) }}%</div>
            <div class="timestamp">
              {{ formatTimestamp(face.timestamp) }}
            </div>
          </div>
          
          <div class="face-actions">
            <el-button
              size="small"
              @click.stop="cropFace(face)"
            >
              裁剪
            </el-button>
            <el-button
              size="small"
              type="primary"
              @click.stop="saveFace(face)"
            >
              保存
            </el-button>
          </div>
        </div>
      </div>

      <div class="statistics">
        <div class="stat-item">
          <span class="label">检测总数:</span>
          <span class="value">{{ detectionStore.faceDetections.length }}</span>
        </div>
        <div class="stat-item">
          <span class="label">当前可见:</span>
          <span class="value">{{ visibleFaces.length }}</span>
        </div>
        <div class="stat-item">
          <span class="label">已识别:</span>
          <span class="value">{{ identifiedFaces.length }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useDetectionStore } from '@/stores/detection'
import type { FaceDetection, VideoFrame } from '@/types'

interface Props {
  canvasWidth: number
  canvasHeight: number
  currentFrame?: VideoFrame
}

const props = defineProps<Props>()
const detectionStore = useDetectionStore()

const selectedFaceId = ref<string>()
const showLandmarks = ref(true)
const enableTracking = ref(true)
const thumbnailCanvases = ref<Map<string, HTMLCanvasElement>>(new Map())

const visibleFaces = computed(() => {
  const now = Date.now()
  return detectionStore.faceDetections.filter(face => 
    now - face.timestamp < 3000
  )
})

const recentFaces = computed(() => {
  return detectionStore.faceDetections
    .slice(-10)
    .reverse()
})

const identifiedFaces = computed(() => {
  return detectionStore.faceDetections.filter(face => face.faceId)
})

function selectFace(face: FaceDetection) {
  selectedFaceId.value = face.faceId
  detectionStore.selectFace(face.faceId || face.id)
}

function setThumbnailCanvas(faceId: string, canvas: HTMLCanvasElement) {
  if (canvas) {
    thumbnailCanvases.value.set(faceId, canvas)
    updateThumbnail(faceId)
  }
}

function updateThumbnail(faceId: string) {
  const canvas = thumbnailCanvases.value.get(faceId)
  const face = detectionStore.faceDetections.find(f => f.id === faceId)
  
  if (canvas && face && props.currentFrame) {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const { x, y, width, height } = face.bbox
      
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(
        props.currentFrame.canvas,
        x, y, width, height,
        0, 0, canvas.width, canvas.height
      )
    }
  }
}

function cropFace(face: FaceDetection) {
  if (!props.currentFrame) return
  
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (ctx) {
    const { x, y, width, height } = face.bbox
    canvas.width = width
    canvas.height = height
    
    ctx.drawImage(
      props.currentFrame.canvas,
      x, y, width, height,
      0, 0, width, height
    )
    
    const link = document.createElement('a')
    link.download = `face_${face.id}_${Date.now()}.png`
    link.href = canvas.toDataURL()
    link.click()
  }
}

function saveFace(face: FaceDetection) {
  const faceData = {
    id: face.id,
    faceId: face.faceId,
    confidence: face.confidence,
    bbox: face.bbox,
    timestamp: face.timestamp,
    landmarks: face.landmarks
  }
  
  const blob = new Blob([JSON.stringify(faceData, null, 2)], {
    type: 'application/json'
  })
  
  const link = document.createElement('a')
  link.download = `face_data_${face.id}.json`
  link.href = URL.createObjectURL(blob)
  link.click()
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

// 监听人脸检测更新，更新缩略图
watch(() => detectionStore.faceDetections.length, () => {
  nextTick(() => {
    recentFaces.value.forEach(face => {
      updateThumbnail(face.id)
    })
  })
})
</script>

<style scoped lang="less">
.face-detection {
  display: flex;
  gap: 16px;
  height: 100%;
}

.detection-overlay {
  position: relative;
  flex: 1;
  
  .annotation-svg {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 10;
    
    .face-bbox {
      fill: none;
      stroke: #4caf50;
      stroke-width: 2;
      stroke-dasharray: 5,5;
      pointer-events: all;
      cursor: pointer;
      
      &.selected {
        stroke: #ff9800;
        stroke-width: 3;
        stroke-dasharray: none;
      }
      
      &:hover {
        stroke-opacity: 0.8;
      }
    }
    
    .confidence-label,
    .face-id-label {
      fill: #4caf50;
      font-size: 12px;
      font-weight: bold;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    }
    
    .landmark-point {
      fill: #ff5722;
      stroke: #fff;
      stroke-width: 1;
    }
  }
}

.face-panel {
  width: 300px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  
  .panel-header {
    padding: 12px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    
    h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
    }
    
    .controls {
      display: flex;
      gap: 12px;
    }
  }
  
  .face-list {
    max-height: 400px;
    overflow-y: auto;
    
    .face-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-bottom: 1px solid #eee;
      cursor: pointer;
      transition: background-color 0.2s;
      
      &:hover {
        background: #f9f9f9;
      }
      
      &.active {
        background: #e3f2fd;
        border-left: 3px solid #2196f3;
      }
      
      .face-thumbnail {
        flex-shrink: 0;
        
        canvas {
          border: 1px solid #ddd;
          border-radius: 4px;
        }
      }
      
      .face-info {
        flex: 1;
        
        .face-id {
          font-weight: bold;
          color: #333;
        }
        
        .confidence {
          font-size: 12px;
          color: #666;
        }
        
        .timestamp {
          font-size: 11px;
          color: #999;
        }
      }
      
      .face-actions {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
    }
  }
  
  .statistics {
    padding: 12px;
    background: #f9f9f9;
    
    .stat-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      
      .label {
        color: #666;
        font-size: 12px;
      }
      
      .value {
        font-weight: bold;
        color: #333;
      }
    }
  }
}
</style>