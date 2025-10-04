export interface ModelConfig {
  modelUrl: string;
  inputSize: number;
  classNames: string[];
}

// 默认的餐具识别模型配置
export const yoloDishModel: ModelConfig = {
  modelUrl: '/models/yolodetection/model.json',
  inputSize: 640,
  classNames: [
    'Fruit_Bowl', 
    'Large_Dish_for_Vegetables', 
    'Large_Noodle_Bowl',
    'Oval_Plate_for_Staple_Food', 
    'Small_Dish_for_Vegetables',
    'Small_Noodle_Bowl', 
    'Yogurt_Container'
  ],
};

// 示例：未来可以轻松添加其他模型配置
// export const faceModel: ModelConfig = {
//   modelUrl: '/models/face_detection/model.json',
//   inputSize: 128,
//   classNames: ['face'],
// };

// 导出默认使用的模型
export const defaultModelConfig = yoloDishModel;
