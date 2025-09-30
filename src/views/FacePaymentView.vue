<template>
  <div class="face-payment-view">
    <div class="header">
      <h1>人脸支付</h1>
      <router-link to="/">
        <el-button>返回检测</el-button>
      </router-link>
    </div>

    <div class="payment-content">
      <div class="camera-section">
        <div class="payment-camera">
          <CameraView
            @frame-capture="onFrameCapture"
            @video-ready="onVideoReady"
          />
          
          <!-- 人脸识别指引 -->
          <div class="face-guide" v-if="!faceDetected">
            <div class="guide-circle">
              <div class="face-outline"></div>
            </div>
            <p>请将面部对准摄像头</p>
          </div>
          
          <!-- 识别成功提示 -->
          <div class="face-detected" v-if="faceDetected && !paymentProcessing">
            <div class="success-icon">✓</div>
            <p>人脸识别成功</p>
          </div>
          
          <!-- 支付处理中 -->
          <div class="payment-processing" v-if="paymentProcessing">
            <el-spin size="large" />
            <p>支付处理中...</p>
          </div>
        </div>
      </div>

      <div class="payment-panel">
        <div class="order-summary">
          <h3>订单详情</h3>
          
          <div class="plates-list" v-if="detectionStore.activePlates.length > 0">
            <div
              v-for="plate in detectionStore.activePlates"
              :key="plate.id"
              class="plate-item"
            >
              <div class="plate-info">
                <span class="plate-label">餐盘 #{{ plate.id.slice(-4) }}</span>
                <span class="plate-price">¥{{ (plate.totalPrice || 0).toFixed(2) }}</span>
              </div>
              
              <div class="dishes" v-if="plate.dishes">
                <div
                  v-for="dish in plate.dishes"
                  :key="dish.id"
                  class="dish-item"
                >
                  <span class="dish-name">{{ dish.name }}</span>
                  <span class="dish-price">¥{{ dish.price.toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="no-order" v-else>
            <p>暂无订单信息</p>
            <router-link to="/">
              <el-button type="primary">前往点餐</el-button>
            </router-link>
          </div>
          
          <div class="total-section" v-if="detectionStore.activePlates.length > 0">
            <div class="total-line">
              <span class="label">小计:</span>
              <span class="amount">¥{{ detectionStore.totalAmount.toFixed(2) }}</span>
            </div>
            <div class="total-line">
              <span class="label">优惠:</span>
              <span class="amount discount">-¥{{ discount.toFixed(2) }}</span>
            </div>
            <div class="total-line final">
              <span class="label">应付金额:</span>
              <span class="amount">¥{{ finalAmount.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <div class="user-info" v-if="recognizedUser">
          <h3>用户信息</h3>
          <div class="user-card">
            <div class="avatar">
              <img :src="recognizedUser.avatar" :alt="recognizedUser.name" />
            </div>
            <div class="user-details">
              <div class="name">{{ recognizedUser.name }}</div>
              <div class="phone">{{ recognizedUser.phone }}</div>
              <div class="balance">余额: ¥{{ recognizedUser.balance.toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <div class="payment-actions">
          <el-button
            v-if="!faceDetected"
            type="primary"
            size="large"
            @click="startFaceRecognition"
            :loading="recognitionProcessing"
          >
            开始人脸识别
          </el-button>
          
          <div v-else-if="recognizedUser && !paymentProcessing">
            <el-button
              type="success"
              size="large"
              @click="processPayment"
              :disabled="finalAmount <= 0"
              style="width: 100%; margin-bottom: 12px;"
            >
              确认支付 ¥{{ finalAmount.toFixed(2) }}
            </el-button>
            
            <el-button
              size="large"
              @click="resetPayment"
              style="width: 100%;"
            >
              重新识别
            </el-button>
          </div>
          
          <div v-else-if="!recognizedUser && faceDetected">
            <p class="error-message">用户识别失败，请重试</p>
            <el-button
              type="primary"
              size="large"
              @click="resetPayment"
              style="width: 100%;"
            >
              重新识别
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 支付结果对话框 -->
    <el-dialog
      v-model="paymentResultVisible"
      :title="paymentSuccess ? '支付成功' : '支付失败'"
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="payment-result">
        <div :class="['result-icon', { success: paymentSuccess, error: !paymentSuccess }]">
          {{ paymentSuccess ? '✓' : '✗' }}
        </div>
        
        <div class="result-message">
          <h3>{{ paymentSuccess ? '支付成功！' : '支付失败' }}</h3>
          <p v-if="paymentSuccess">
            感谢您的消费，祝您用餐愉快！
          </p>
          <p v-else>
            {{ paymentErrorMessage }}
          </p>
          
          <div v-if="paymentSuccess" class="payment-details">
            <div class="detail-item">
              <span>支付金额:</span>
              <span>¥{{ finalAmount.toFixed(2) }}</span>
            </div>
            <div class="detail-item">
              <span>支付时间:</span>
              <span>{{ new Date().toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <el-button
          type="primary"
          @click="handlePaymentComplete"
        >
          {{ paymentSuccess ? '完成' : '重试' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useDetectionStore } from '@/stores/detection'
import CameraView from '@/components/CameraView.vue'
import type { VideoFrame } from '@/types'

interface User {
  id: string
  name: string
  phone: string
  avatar: string
  balance: number
  faceId: string
}

const router = useRouter()
const detectionStore = useDetectionStore()

const faceDetected = ref(false)
const recognitionProcessing = ref(false)
const paymentProcessing = ref(false)
const recognizedUser = ref<User>()
const discount = ref(5.0) // 固定优惠5元
const paymentResultVisible = ref(false)
const paymentSuccess = ref(false)
const paymentErrorMessage = ref('')

// 模拟用户数据库
const mockUsers: User[] = [
  {
    id: '1',
    name: '张三',
    phone: '138****1234',
    avatar: '/avatars/user1.jpg',
    balance: 500.00,
    faceId: 'face_001'
  },
  {
    id: '2',
    name: '李四',
    phone: '139****5678',
    avatar: '/avatars/user2.jpg',
    balance: 300.00,
    faceId: 'face_002'
  }
]

const finalAmount = computed(() => {
  return Math.max(0, detectionStore.totalAmount - discount.value)
})

function onVideoReady(_video: HTMLVideoElement) {
  console.log('人脸支付摄像头就绪')
}

function onFrameCapture(_frame: VideoFrame) {
  // 在支付页面进行实时人脸检测
  if (recognitionProcessing.value) {
    // 模拟人脸检测和识别
    simulateFaceRecognition()
  }
}

async function startFaceRecognition() {
  recognitionProcessing.value = true
  faceDetected.value = false
  recognizedUser.value = undefined
  
  // 模拟人脸识别过程
  setTimeout(() => {
    simulateFaceRecognition()
  }, 2000)
}

function simulateFaceRecognition() {
  // 模拟人脸检测成功
  faceDetected.value = true
  
  // 模拟用户识别（随机选择一个用户）
  setTimeout(() => {
    const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)]
    recognizedUser.value = randomUser
    recognitionProcessing.value = false
  }, 1000)
}

async function processPayment() {
  if (!recognizedUser.value) return
  
  paymentProcessing.value = true
  
  try {
    // 模拟支付处理
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // 检查余额
    if (recognizedUser.value.balance >= finalAmount.value) {
      // 扣除余额
      recognizedUser.value.balance -= finalAmount.value
      paymentSuccess.value = true
    } else {
      paymentSuccess.value = false
      paymentErrorMessage.value = '账户余额不足，请充值后重试'
    }
    
    paymentResultVisible.value = true
  } catch (_error) {
    paymentSuccess.value = false
    paymentErrorMessage.value = '支付处理异常，请重试'
    paymentResultVisible.value = true
  } finally {
    paymentProcessing.value = false
  }
}

function resetPayment() {
  faceDetected.value = false
  recognizedUser.value = undefined
  recognitionProcessing.value = false
  paymentProcessing.value = false
}

function handlePaymentComplete() {
  paymentResultVisible.value = false
  
  if (paymentSuccess.value) {
    // 支付成功，清空检测结果并返回检测页面
    detectionStore.clearDetections()
    router.push('/')
  } else {
    // 支付失败，重置状态
    resetPayment()
  }
}

onMounted(() => {
  // 如果没有订单信息，提示用户先去点餐
  if (detectionStore.activePlates.length === 0) {
    ElMessage.warning('请先进行点餐识别')
  }
})
</script>

<style scoped lang="less">
.face-payment-view {
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

.payment-content {
  display: flex;
  flex: 1;
  gap: 24px;
  padding: 24px;
  
  .camera-section {
    flex: 1;
    
    .payment-camera {
      position: relative;
      display: inline-block;
      
      .face-guide {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        color: #fff;
        z-index: 20;
        
        .guide-circle {
          width: 200px;
          height: 200px;
          border: 3px solid #4caf50;
          border-radius: 50%;
          margin: 0 auto 16px;
          position: relative;
          
          .face-outline {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 120px;
            height: 150px;
            border: 2px solid #4caf50;
            border-radius: 60px 60px 80px 80px;
          }
        }
        
        p {
          font-size: 18px;
          font-weight: bold;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        }
      }
      
      .face-detected {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        color: #fff;
        z-index: 20;
        
        .success-icon {
          width: 80px;
          height: 80px;
          background: #4caf50;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          margin: 0 auto 16px;
        }
        
        p {
          font-size: 18px;
          font-weight: bold;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        }
      }
      
      .payment-processing {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        color: #fff;
        z-index: 20;
        
        p {
          margin-top: 16px;
          font-size: 18px;
          font-weight: bold;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        }
      }
    }
  }
  
  .payment-panel {
    width: 400px;
    background: #fff;
    border-radius: 8px;
    padding: 24px;
    height: fit-content;
    
    .order-summary {
      margin-bottom: 24px;
      
      h3 {
        margin: 0 0 16px 0;
        color: #333;
      }
      
      .plates-list {
        .plate-item {
          margin-bottom: 16px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
          
          .plate-info {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            margin-bottom: 8px;
            
            .plate-price {
              color: #2196f3;
            }
          }
          
          .dishes {
            .dish-item {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 14px;
              color: #666;
              
              .dish-price {
                color: #ff9800;
              }
            }
          }
        }
      }
      
      .no-order {
        text-align: center;
        padding: 40px 0;
        color: #999;
      }
      
      .total-section {
        border-top: 1px solid #eee;
        padding-top: 16px;
        
        .total-line {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          
          &.final {
            font-size: 18px;
            font-weight: bold;
            color: #f44336;
            border-top: 1px solid #eee;
            padding-top: 8px;
            margin-top: 8px;
          }
          
          .discount {
            color: #4caf50;
          }
        }
      }
    }
    
    .user-info {
      margin-bottom: 24px;
      
      h3 {
        margin: 0 0 16px 0;
        color: #333;
      }
      
      .user-card {
        display: flex;
        align-items: center;
        padding: 16px;
        background: #f0f8ff;
        border-radius: 8px;
        border: 1px solid #e3f2fd;
        
        .avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          overflow: hidden;
          margin-right: 16px;
          background: #ddd;
          
          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }
        
        .user-details {
          .name {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            margin-bottom: 4px;
          }
          
          .phone {
            color: #666;
            font-size: 14px;
            margin-bottom: 4px;
          }
          
          .balance {
            color: #4caf50;
            font-weight: bold;
          }
        }
      }
    }
    
    .payment-actions {
      .error-message {
        color: #f44336;
        text-align: center;
        margin-bottom: 16px;
      }
    }
  }
}

.payment-result {
  text-align: center;
  
  .result-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    margin: 0 auto 20px;
    
    &.success {
      background: #4caf50;
      color: white;
    }
    
    &.error {
      background: #f44336;
      color: white;
    }
  }
  
  .result-message {
    h3 {
      margin: 0 0 12px 0;
      color: #333;
    }
    
    p {
      color: #666;
      margin-bottom: 20px;
    }
    
    .payment-details {
      text-align: left;
      background: #f9f9f9;
      padding: 16px;
      border-radius: 6px;
      
      .detail-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        
        &:last-child {
          margin-bottom: 0;
        }
      }
    }
  }
}
</style>