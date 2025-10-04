import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'

// --- 权威模型管家 (Authoritative Model Manager) ---
// 整个应用的唯一TF.js和模型来源

// --- 1. 内部状态和常量 ---
let model: tf.GraphModel | null = null
let initPromise: Promise<void> | null = null

const MODEL_URL = '/models/yolodetection/model.json'
const INPUT_SIZE = 640
const CLASS_NAMES = [
    'Fruit_Bowl', 'Large_Dish_for_Vegetables', 'Large_Noodle_Bowl',
    'Oval_Plate_for_Staple_Food', 'Small_Dish_for_Vegetables',
    'Small_Noodle_Bowl', 'Yogurt_Container'
]

export interface Detection {
  class: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

// --- 2. 核心初始化函数 (只执行一次) ---
export function initialize(): Promise<void> {
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      console.log('🤖 [TfModelManager] 开始全局唯一初始化...')
      
      // a. 设置后端并等待就绪
      await tf.setBackend('webgl')
      await tf.ready()
      console.log(`✅ [TfModelManager] 后端已就绪: ${tf.getBackend()}`)

      // b. 加载模型
      console.log(`📥 [TfModelManager] 正在加载模型: ${MODEL_URL}`)
      model = await tf.loadGraphModel(MODEL_URL)
      console.log('✅ [TfModelManager] 模型加载成功')

      // c. 预热模型 (关键步骤，确保首次检测流畅)
      console.log('🔥 [TfModelManager] 正在预热模型...')
      const dummyInput = tf.zeros([1, INPUT_SIZE, INPUT_SIZE, 3])
      const result = model.predict(dummyInput) as tf.Tensor
      result.dispose()
      dummyInput.dispose()
      console.log('✅ [TfModelManager] 模型预热完成')

    } catch (error) {
      console.error('❌ [TfModelManager] 初始化失败:', error)
      // 如果失败，重置Promise以便下次可以重试
      initPromise = null 
      throw error // 将错误向上抛出
    }
  })()

  return initPromise
}

export interface DetectionOptions {
  confidenceThreshold: number;
  iouThreshold: number;
}

// --- 3. 核心检测函数 ---
export async function detectObjects(
  image: HTMLImageElement | HTMLCanvasElement, 
  options: DetectionOptions
): Promise<Detection[]> {
  if (!model) {
    throw new Error('模型尚未初始化，请先调用initialize()')
  }

  const { confidenceThreshold, iouThreshold } = options

  return tf.tidy(() => {
    // a. 预处理
    const img = tf.browser.fromPixels(image)
    const resized = tf.image.resizeBilinear(img, [INPUT_SIZE, INPUT_SIZE])
    const normalized = resized.div(255.0)
    const tensor = normalized.expandDims(0)

    // b. 推理
    const predictions = model!.predict(tensor) as tf.Tensor

    // c. 后处理
    const data = predictions.dataSync()
    const [batch, features, numDetections] = predictions.shape
    const scaleX = image.width / INPUT_SIZE
    const scaleY = image.height / INPUT_SIZE
    
    // d. 解码边界框和分数
    const boxes: number[][] = []
    const scores: number[] = []
    const classIndices: number[] = []

    for (let i = 0; i < numDetections; i++) {
      let maxClassScore = 0
      let maxClassIndex = -1
      for (let classIdx = 0; classIdx < CLASS_NAMES.length; classIdx++) {
        const score = data[(4 + classIdx) * numDetections + i]
        if (score > maxClassScore) {
          maxClassScore = score
          maxClassIndex = classIdx
        }
      }

      if (maxClassScore > confidenceThreshold) {
        const xCenter = data[0 * numDetections + i] * scaleX
        const yCenter = data[1 * numDetections + i] * scaleY
        const width = data[2 * numDetections + i] * scaleX
        const height = data[3 * numDetections + i] * scaleY
        
        const x1 = xCenter - width / 2
        const y1 = yCenter - height / 2
        // NMS需要[y1, x1, y2, x2]格式
        boxes.push([y1, x1, y1 + height, x1 + width])
        scores.push(maxClassScore)
        classIndices.push(maxClassIndex)
      }
    }

    // e. 执行非极大值抑制 (NMS)
    const nmsIndices = tf.image.nonMaxSuppression(
      boxes, 
      scores, 
      50, // 最多返回50个对象
      iouThreshold
    ).dataSync() as Uint8Array

    // f. 构建最终结果
    const finalDetections: Detection[] = []
    for (let i = 0; i < nmsIndices.length; i++) {
      const index = nmsIndices[i]
      const [y1, x1, y2, x2] = boxes[index]
      finalDetections.push({
        class: CLASS_NAMES[classIndices[index]],
        confidence: scores[index],
        bbox: {
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
        }
      })
    }
    
    return finalDetections
  })
}

// --- 4. 辅助函数 (可选) ---
export function isReady(): boolean {
  return model !== null
}
