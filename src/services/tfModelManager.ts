import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import type { ModelConfig } from '@/models.config'

// --- 可配置、可复用的模型管理器 ---

export interface DetectionOptions {
  confidenceThreshold: number;
  iouThreshold: number;
}

export interface Detection {
  class: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

class ModelManager {
  private model: tf.GraphModel | null = null;
  private config: ModelConfig | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * 使用指定的模型配置来初始化管理器。
   * 这个函数是幂等的，只会执行一次有效的初始化。
   */
  initialize(config: ModelConfig): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.config = config;
        console.log('🤖 [ModelManager] 开始使用配置进行初始化:', this.config.modelUrl);

        await tf.setBackend('webgl');
        await tf.ready();
        console.log(`✅ [ModelManager] 后端已就绪: ${tf.getBackend()}`);

        this.model = await tf.loadGraphModel(this.config.modelUrl);
        console.log('✅ [ModelManager] 模型加载成功');

        const dummyInput = tf.zeros([1, this.config.inputSize, this.config.inputSize, 3]);
        const result = this.model.predict(dummyInput) as tf.Tensor;
        result.dispose();
        dummyInput.dispose();
        console.log('✅ [ModelManager] 模型预热完成');

      } catch (error) {
        console.error('❌ [ModelManager] 初始化失败:', error);
        this.initPromise = null; // 允许重试
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * 检查管理器是否已准备好进行检测。
   */
  isReady(): boolean {
    return this.model !== null && this.config !== null;
  }

  /**
   * 对给定的图像执行对象检测。
   */
  async detectObjects(image: HTMLImageElement | HTMLCanvasElement, options: DetectionOptions): Promise<Detection[]> {
    if (!this.isReady() || !this.model || !this.config) {
      throw new Error('模型管理器尚未初始化');
    }

    const { confidenceThreshold, iouThreshold } = options;
    const { inputSize, classNames } = this.config;

    return tf.tidy(() => {
      const img = tf.browser.fromPixels(image);
      const resized = tf.image.resizeBilinear(img, [inputSize, inputSize]);
      const normalized = resized.div(255.0);
      const tensor = normalized.expandDims(0);

      const predictions = this.model!.predict(tensor) as tf.Tensor;
      const data = predictions.dataSync();
      const [batch, features, numDetections] = predictions.shape;
      const scaleX = image.width / inputSize;
      const scaleY = image.height / inputSize;

      const boxes: number[][] = [];
      const scores: number[] = [];
      const classIndices: number[] = [];

      for (let i = 0; i < numDetections; i++) {
        let maxClassScore = 0;
        let maxClassIndex = -1;
        for (let classIdx = 0; classIdx < classNames.length; classIdx++) {
          const score = data[(4 + classIdx) * numDetections + i];
          if (score > maxClassScore) {
            maxClassScore = score;
            maxClassIndex = classIdx;
          }
        }

        if (maxClassScore > confidenceThreshold) {
          const xCenter = data[0 * numDetections + i] * scaleX;
          const yCenter = data[1 * numDetections + i] * scaleY;
          const width = data[2 * numDetections + i] * scaleX;
          const height = data[3 * numDetections + i] * scaleY;
          
          const x1 = xCenter - width / 2;
          const y1 = yCenter - height / 2;
          boxes.push([y1, x1, y1 + height, x1 + width]);
          scores.push(maxClassScore);
          classIndices.push(maxClassIndex);
        }
      }

      const nmsIndices = tf.image.nonMaxSuppression(boxes, scores, 50, iouThreshold).dataSync() as Uint8Array;

      const finalDetections: Detection[] = [];
      for (let i = 0; i < nmsIndices.length; i++) {
        const index = nmsIndices[i];
        const [y1, x1, y2, x2] = boxes[index];
        finalDetections.push({
          class: classNames[classIndices[index]],
          confidence: scores[index],
          bbox: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
        });
      }
      
      return finalDetections;
    });
  }
}

// 导出一个ModelManager的单例，供整个应用使用
export const modelManager = new ModelManager();