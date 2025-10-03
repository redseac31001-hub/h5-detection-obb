import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import '@tensorflow/tfjs-backend-cpu'

let isInitialized = false
let initPromise: Promise<void> | null = null

/**
 * 安全初始化TensorFlow.js
 */
export async function initializeTensorFlow(): Promise<boolean> {
  if (isInitialized) {
    return true
  }
  
  if (initPromise) {
    await initPromise
    return isInitialized
  }

  initPromise = (async () => {
    try {
      console.log('🔄 开始初始化TensorFlow.js...')
      
      // 确保基础就绪
      await tf.ready()
      
      // 尝试设置最佳后端
      const backends = ['webgl', 'cpu']
      let backendSet = false
      
      for (const backend of backends) {
        try {
          console.log(`🔧 尝试设置 ${backend} 后端...`)
          await tf.setBackend(backend)
          await tf.ready()
          console.log(`✅ ${backend} 后端设置成功`)
          backendSet = true
          break
        } catch (error) {
          console.warn(`⚠️ ${backend} 后端设置失败:`, error)
        }
      }
      
      if (!backendSet) {
        throw new Error('无法设置任何TensorFlow.js后端')
      }
      
      // 验证后端是否正常工作
      const testTensor = tf.tensor([1, 2, 3, 4])
      const result = await testTensor.data()
      testTensor.dispose()
      
      if (result.length !== 4) {
        throw new Error('TensorFlow.js后端测试失败')
      }
      
      console.log('✅ TensorFlow.js初始化完成，当前后端:', tf.getBackend())
      console.log('📊 内存信息:', tf.memory())
      
      isInitialized = true
      
    } catch (error) {
      console.error('❌ TensorFlow.js初始化失败:', error)
      isInitialized = false
      throw error
    }
  })()
  
  await initPromise
  return isInitialized
}

/**
 * 检查TensorFlow.js是否已初始化
 */
export function isTensorFlowReady(): boolean {
  return isInitialized && tf.getBackend() !== null
}

/**
 * 获取当前后端信息
 */
export function getTensorFlowInfo(): {
  backend: string | null
  memory: tf.MemoryInfo | null
  ready: boolean
} {
  try {
    return {
      backend: tf.getBackend(),
      memory: tf.memory(),
      ready: isInitialized
    }
  } catch (error) {
    return {
      backend: null,
      memory: null,
      ready: false
    }
  }
}

/**
 * 重置TensorFlow.js状态
 */
export function resetTensorFlow(): void {
  isInitialized = false
  initPromise = null
}