<template>
  <div class="plate-detection">
    <div class="detection-overlay">
      <svg
        :width="canvasWidth"
        :height="canvasHeight"
        class="annotation-svg"
      >
        <g v-for="plate in visiblePlates" :key="plate.id">
          <!-- 餐盘边界框 -->
          <rect
            :x="plate.bbox.x"
            :y="plate.bbox.y"
            :width="plate.bbox.width"
            :height="plate.bbox.height"
            class="plate-bbox"
            @click="selectPlate(plate)"
          />
          
          <!-- 餐盘信息标签 -->
          <text
            :x="plate.bbox.x"
            :y="plate.bbox.y - 5"
            class="plate-label"
          >
            Plate: {{ (plate.confidence * 100).toFixed(1) }}%
          </text>
          
          <!-- 价格标签 -->
          <text
            v-if="plate.totalPrice"
            :x="plate.bbox.x + plate.bbox.width - 60"
            :y="plate.bbox.y - 5"
            class="price-label"
          >
            ¥{{ plate.totalPrice.toFixed(2) }}
          </text>
          
          <!-- 菜品检测框 -->
          <g v-if="plate.dishes">
            <rect
              v-for="dish in plate.dishes"
              :key="dish.id"
              :x="dish.bbox.x"
              :y="dish.bbox.y"
              :width="dish.bbox.width"
              :height="dish.bbox.height"
              class="dish-bbox"
            />
            <text
              v-for="dish in plate.dishes"
              :key="`label-${dish.id}`"
              :x="dish.bbox.x"
              :y="dish.bbox.y - 2"
              class="dish-label"
            >
              {{ dish.name }}: ¥{{ dish.price }}
            </text>
          </g>
        </g>
      </svg>
    </div>

    <div class="plate-panel">
      <div class="panel-header">
        <h3>餐盘识别</h3>
        <div class="controls">
          <el-button
            size="small"
            type="primary"
            @click="calculateTotal"
            :disabled="!hasActivePlates"
          >
            计算总价
          </el-button>
          <el-button
            size="small"
            @click="clearPlates"
          >
            清空
          </el-button>
        </div>
      </div>

      <div class="plate-list">
        <div
          v-for="plate in recentPlates"
          :key="plate.id"
          class="plate-item"
        >
          <div class="plate-preview">
            <canvas
              :ref="el => setPlateCanvas(plate.id, el as HTMLCanvasElement)"
              width="80"
              height="60"
            />
          </div>
          
          <div class="plate-details">
            <div class="plate-info">
              <span class="confidence">{{ (plate.confidence * 100).toFixed(1) }}%</span>
              <span class="timestamp">{{ formatTimestamp(plate.timestamp) }}</span>
            </div>
            
            <div class="dish-list" v-if="plate.dishes && plate.dishes.length > 0">
              <div
                v-for="dish in plate.dishes"
                :key="dish.id"
                class="dish-item"
              >
                <span class="dish-name">{{ dish.name }}</span>
                <span class="dish-price">¥{{ dish.price.toFixed(2) }}</span>
              </div>
            </div>
            
            <div class="total-price" v-if="plate.totalPrice">
              <strong>总计: ¥{{ plate.totalPrice.toFixed(2) }}</strong>
            </div>
          </div>
          
          <div class="plate-actions">
            <el-button
              size="small"
              @click="editPlate(plate)"
            >
              编辑
            </el-button>
            <el-button
              size="small"
              @click="cropPlate(plate)"
            >
              裁剪
            </el-button>
          </div>
        </div>
      </div>

      <div class="pricing-section">
        <h4>总计信息</h4>
        <div class="total-summary">
          <div class="summary-item">
            <span>餐盘数量:</span>
            <span>{{ activePlatesCount }}</span>
          </div>
          <div class="summary-item">
            <span>菜品总数:</span>
            <span>{{ totalDishCount }}</span>
          </div>
          <div class="summary-item total">
            <span>应付金额:</span>
            <span class="amount">¥{{ detectionStore.totalAmount.toFixed(2) }}</span>
          </div>
        </div>
        
        <el-button
          type="success"
          size="large"
          class="pay-button"
          @click="processPayment"
          :disabled="detectionStore.totalAmount === 0"
        >
          确认支付
        </el-button>
      </div>
    </div>

    <!-- 编辑餐盘对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑餐盘信息"
      width="500px"
    >
      <div v-if="editingPlate">
        <div class="edit-section">
          <h4>菜品列表</h4>
          <div
            v-for="(dish, index) in editingPlate.dishes"
            :key="dish.id"
            class="edit-dish-item"
          >
            <el-input
              v-model="dish.name"
              placeholder="菜品名称"
              size="small"
              style="width: 150px; margin-right: 8px;"
            />
            <el-input-number
              v-model="dish.price"
              :min="0"
              :precision="2"
              size="small"
              style="width: 100px; margin-right: 8px;"
            />
            <el-button
              size="small"
              type="danger"
              @click="removeDish(index)"
            >
              删除
            </el-button>
          </div>
          
          <el-button
            size="small"
            type="primary"
            @click="addDish"
          >
            添加菜品
          </el-button>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEditedPlate">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useDetectionStore } from '@/stores/detection'
import type { PlateDetection, VideoFrame } from '@/types'

interface Props {
  canvasWidth: number
  canvasHeight: number
  currentFrame?: VideoFrame
}

const props = defineProps<Props>()
const detectionStore = useDetectionStore()

const plateCanvases = ref<Map<string, HTMLCanvasElement>>(new Map())
const editDialogVisible = ref(false)
const editingPlate = ref<PlateDetection>()

const visiblePlates = computed(() => {
  return detectionStore.activePlates
})

const recentPlates = computed(() => {
  return detectionStore.plateDetections
    .slice(-5)
    .reverse()
})

const hasActivePlates = computed(() => {
  return detectionStore.activePlates.length > 0
})

const activePlatesCount = computed(() => {
  return detectionStore.activePlates.length
})

const totalDishCount = computed(() => {
  return detectionStore.plateDetections.reduce((total, plate) => {
    return total + (plate.dishes?.length || 0)
  }, 0)
})

function selectPlate(plate: PlateDetection) {
  console.log('选中餐盘:', plate)
}

function setPlateCanvas(plateId: string, canvas: HTMLCanvasElement) {
  if (canvas) {
    plateCanvases.value.set(plateId, canvas)
    updatePlatePreview(plateId)
  }
}

function updatePlatePreview(plateId: string) {
  const canvas = plateCanvases.value.get(plateId)
  const plate = detectionStore.plateDetections.find(p => p.id === plateId)
  
  if (canvas && plate && props.currentFrame) {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const { x, y, width, height } = plate.bbox
      
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(
        props.currentFrame.canvas,
        x, y, width, height,
        0, 0, canvas.width, canvas.height
      )
    }
  }
}

function calculateTotal() {
  // 模拟菜品识别和价格计算
  detectionStore.plateDetections.forEach(plate => {
    if (!plate.dishes) {
      plate.dishes = [
        {
          id: `dish_${Date.now()}_1`,
          class: 'dish',
          name: '宫保鸡丁',
          price: 28,
          confidence: 0.85,
          bbox: {
            x: plate.bbox.x + 10,
            y: plate.bbox.y + 10,
            width: plate.bbox.width - 20,
            height: plate.bbox.height - 20
          },
          timestamp: Date.now()
        }
      ]
    }
    
    const totalPrice = plate.dishes.reduce((sum, dish) => sum + dish.price, 0)
    detectionStore.updatePlatePrice(plate.id, totalPrice)
  })
}

function clearPlates() {
  detectionStore.plateDetections.splice(0)
}

function editPlate(plate: PlateDetection) {
  editingPlate.value = { ...plate }
  if (!editingPlate.value.dishes) {
    editingPlate.value.dishes = []
  }
  editDialogVisible.value = true
}

function cropPlate(plate: PlateDetection) {
  if (!props.currentFrame) return
  
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (ctx) {
    const { x, y, width, height } = plate.bbox
    canvas.width = width
    canvas.height = height
    
    ctx.drawImage(
      props.currentFrame.canvas,
      x, y, width, height,
      0, 0, width, height
    )
    
    const link = document.createElement('a')
    link.download = `plate_${plate.id}_${Date.now()}.png`
    link.href = canvas.toDataURL()
    link.click()
  }
}

function addDish() {
  if (editingPlate.value) {
    if (!editingPlate.value.dishes) {
      editingPlate.value.dishes = []
    }
    
    editingPlate.value.dishes.push({
      id: `dish_${Date.now()}`,
      class: 'dish',
      name: '新菜品',
      price: 0,
      confidence: 1,
      bbox: {
        x: 0,
        y: 0,
        width: 50,
        height: 50
      },
      timestamp: Date.now()
    })
  }
}

function removeDish(index: number) {
  if (editingPlate.value?.dishes) {
    editingPlate.value.dishes.splice(index, 1)
  }
}

function saveEditedPlate() {
  if (editingPlate.value) {
    const originalPlate = detectionStore.plateDetections.find(p => p.id === editingPlate.value!.id)
    if (originalPlate) {
      originalPlate.dishes = editingPlate.value.dishes
      const totalPrice = originalPlate.dishes?.reduce((sum, dish) => sum + dish.price, 0) || 0
      detectionStore.updatePlatePrice(originalPlate.id, totalPrice)
    }
  }
  editDialogVisible.value = false
}

function processPayment() {
  const paymentData = {
    totalAmount: detectionStore.totalAmount,
    plates: detectionStore.activePlates,
    timestamp: Date.now()
  }
  
  console.log('处理支付:', paymentData)
  
  // 这里可以集成支付API
  // 支付成功后清空检测结果
  setTimeout(() => {
    detectionStore.clearDetections()
  }, 1000)
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

// 监听餐盘检测更新
watch(() => detectionStore.plateDetections.length, () => {
  nextTick(() => {
    recentPlates.value.forEach(plate => {
      updatePlatePreview(plate.id)
    })
  })
})
</script>

<style scoped lang="less">
.plate-detection {
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
    
    .plate-bbox {
      fill: none;
      stroke: #2196f3;
      stroke-width: 2;
      pointer-events: all;
      cursor: pointer;
      
      &:hover {
        stroke-opacity: 0.8;
      }
    }
    
    .dish-bbox {
      fill: none;
      stroke: #ff9800;
      stroke-width: 1.5;
      stroke-dasharray: 3,3;
    }
    
    .plate-label,
    .price-label {
      fill: #2196f3;
      font-size: 12px;
      font-weight: bold;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    }
    
    .dish-label {
      fill: #ff9800;
      font-size: 10px;
      font-weight: bold;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    }
  }
}

.plate-panel {
  width: 350px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  
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
      gap: 8px;
    }
  }
  
  .plate-list {
    flex: 1;
    max-height: 300px;
    overflow-y: auto;
    
    .plate-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      border-bottom: 1px solid #eee;
      
      .plate-preview {
        flex-shrink: 0;
        
        canvas {
          border: 1px solid #ddd;
          border-radius: 4px;
        }
      }
      
      .plate-details {
        flex: 1;
        
        .plate-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
          color: #666;
        }
        
        .dish-list {
          .dish-item {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            font-size: 12px;
            
            .dish-name {
              color: #333;
            }
            
            .dish-price {
              color: #ff9800;
              font-weight: bold;
            }
          }
        }
        
        .total-price {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #eee;
          color: #2196f3;
          font-size: 14px;
        }
      }
      
      .plate-actions {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
    }
  }
  
  .pricing-section {
    padding: 16px;
    background: #f9f9f9;
    border-top: 1px solid #ddd;
    
    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #333;
    }
    
    .total-summary {
      margin-bottom: 16px;
      
      .summary-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 14px;
        
        &.total {
          padding-top: 8px;
          border-top: 1px solid #ddd;
          font-weight: bold;
          font-size: 16px;
          
          .amount {
            color: #f44336;
          }
        }
      }
    }
    
    .pay-button {
      width: 100%;
    }
  }
}

.edit-section {
  .edit-dish-item {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
  }
}
</style>