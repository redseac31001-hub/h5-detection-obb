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
      
      // 重置状态确保干净初始化
      isInitialized = false
      
      // 确保基础就绪
      await tf.ready()
      
      // 尝试设置最佳后端，增加重试逻辑
      const backends = ['webgl', 'cpu']
      let backendSet = false
      
      for (const backend of backends) {
        try {
          console.log(`🔧 尝试设置 ${backend} 后端...`)
          
          // 强制设置后端
          await tf.setBackend(backend)
          await tf.ready()
          
          // 额外验证后端是否真正可用
          const backendName = tf.getBackend()
          if (backendName === backend) {
            console.log(`✅ ${backend} 后端设置成功`)
            backendSet = true
            break
          } else {
            console.warn(`⚠️ ${backend} 后端设置不一致，实际: ${backendName}`)
          }
        } catch (error) {
          console.warn(`⚠️ ${backend} 后端设置失败:`, error)
        }
      }
      
      if (!backendSet) {
        throw new Error('无法设置任何TensorFlow.js后端')
      }
      
      // 增强的后端验证测试
      try {
        const testTensor = tf.tensor([1, 2, 3, 4])
        const result = await testTensor.data()
        testTensor.dispose()
        
        if (result.length !== 4) {
          throw new Error('TensorFlow.js后端测试失败')
        }
        
        // 额外测试矩阵运算
        const testMatrix = tf.tensor2d([[1, 2], [3, 4]])
        const matResult = await testMatrix.data()
        testMatrix.dispose()
        
        if (matResult.length !== 4) {
          throw new Error('TensorFlow.js矩阵运算测试失败')
        }
      } catch (testError) {
        console.error('❌ TensorFlow.js功能测试失败:', testError)
        throw testError
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
  initPromise = null // 重置Promise，允许重新初始化
  return isInitialized
}

/**
 * 检查TensorFlow.js是否已初始化
 */
export function isTensorFlowReady(): boolean {
  try {
    return isInitialized && tf.getBackend() !== null
  } catch (error) {
    console.warn('⚠️ TensorFlow backend检查失败:', error)
    return false
  }
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
    console.warn('⚠️ 获取TensorFlow信息失败:', error)
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