# 🚀 YOLO模型部署指南

本指南详细说明如何为餐厅AI识别系统准备、转换和部署YOLO模型。

## 📁 模型文件结构

```
public/models/
├── face_detection_model/
│   ├── model.json              # TensorFlow.js模型配置
│   ├── group1-shard1of1.bin    # 模型权重文件
│   └── model_info.json         # 扩展模型信息
├── plate_detection_model/
│   ├── model.json              # TensorFlow.js模型配置  
│   ├── group1-shard1of1.bin    # 模型权重文件
│   └── model_info.json         # 扩展模型信息
└── README.md                   # 模型说明文档
```

## 🎯 模型要求规范

### 人脸检测模型
- **输入格式**: `[1, 640, 640, 3]` (批次, 高度, 宽度, 通道)
- **输出格式**: `[1, N, 6]` (批次, 检测数量, [x, y, w, h, confidence, class])
- **检测类别**: `["face"]`
- **推荐阈值**: 置信度 0.5, IoU 0.4
- **最大检测数**: 10

### 餐盘检测模型  
- **输入格式**: `[1, 640, 640, 3]` (批次, 高度, 宽度, 通道)
- **输出格式**: `[1, N, 85]` (批次, 检测数量, [x, y, w, h, conf, class1, class2, ...])
- **检测类别**: 餐具、食物、饮品等 (详见model_info.json)
- **推荐阈值**: 置信度 0.6, IoU 0.5  
- **最大检测数**: 20
- **价格映射**: 支持每个类别的价格配置

## 🔄 模型转换流程

### 方法1: 从ONNX转换 (推荐)

```bash
# 1. 安装依赖
pip install tf2onnx tensorflow
npm install -g @tensorflow/tfjs-converter

# 2. ONNX转TensorFlow SavedModel
python -m tf2onnx.convert \\
    --onnx your_model.onnx \\
    --output saved_model \\
    --inputs images:0 \\
    --outputs output0:0

# 3. SavedModel转TensorFlow.js
tensorflowjs_converter \\
    --input_format=tf_saved_model \\
    --output_node_names='Identity,Identity_1,Identity_2' \\
    --saved_model_tags=serve \\
    saved_model \\
    ./public/models/face_detection_model
```

### 方法2: 从PyTorch转换

```python
import torch
from ultralytics import YOLO

# 加载PyTorch模型
model = YOLO('your_model.pt')

# 导出为ONNX
model.export(format='onnx', imgsz=640)

# 然后按方法1继续转换
```

### 方法3: 使用Ultralytics直接导出

```python
from ultralytics import YOLO

# 加载训练好的模型
model = YOLO('your_trained_model.pt')

# 直接导出为TensorFlow.js格式
model.export(format='tfjs', imgsz=640)
```

## 🛠️ 快速部署工具

### 使用模型替换脚本

```bash
# 复制脚本到可执行位置
cd restaurant-ai-system/scripts

# 替换人脸检测模型
node replace_model.js --type face --model /path/to/your/face_model/model.json

# 替换餐盘检测模型  
node replace_model.js --type plate --model /path/to/your/plate_model/model.json

# 查看备份列表
node replace_model.js --list-backups
```

### 手动部署步骤

1. **备份现有模型**
   ```bash
   cp -r public/models/face_detection_model public/models/face_detection_model_backup
   ```

2. **复制新模型文件**
   ```bash
   cp your_model/model.json public/models/face_detection_model/
   cp your_model/*.bin public/models/face_detection_model/
   ```

3. **更新模型信息** (可选)
   ```bash
   cp your_model/model_info.json public/models/face_detection_model/
   ```

## 📝 模型信息配置

### model_info.json 示例

```json
{
  "name": "YOLOv8n Face Detection",
  "version": "2.0.0",
  "description": "优化的餐厅人脸检测模型",
  "input_shape": [1, 640, 640, 3],
  "output_shape": [1, 25200, 6],
  "classes": ["face"],
  "confidence_threshold": 0.6,
  "iou_threshold": 0.4,
  "max_detections": 10,
  "preprocessing": {
    "normalize": true,
    "mean": [0, 0, 0],
    "std": [255, 255, 255]
  },
  "postprocessing": {
    "format": "yolo",
    "bbox_format": "xywh_center",
    "output_format": "[x, y, w, h, confidence, class]"
  }
}
```

### 餐盘模型价格配置

```json
{
  "price_mapping": {
    "rice": 12.0,
    "noodles": 18.0,
    "chicken": 28.0,
    "beef": 45.0,
    "vegetables": 15.0,
    "soup": 12.0,
    "drink": 8.0
  }
}
```

## 🧪 模型测试验证

### 1. 基本加载测试

```javascript
// 在浏览器控制台中测试
const model = await tf.loadGraphModel('/models/face_detection_model/model.json');
console.log('模型输入形状:', model.inputs[0].shape);
console.log('模型输出形状:', model.outputs[0].shape);
```

### 2. 推理测试

```javascript
// 创建测试输入
const testInput = tf.randomNormal([1, 640, 640, 3]);
const prediction = model.predict(testInput);
console.log('推理输出形状:', prediction.shape);
```

### 3. 性能测试

```javascript
// 测试推理时间
const start = performance.now();
const prediction = model.predict(testInput);
await prediction.data(); // 等待GPU计算完成
const inferenceTime = performance.now() - start;
console.log('推理时间:', inferenceTime, 'ms');
```

## 🎛️ 性能优化建议

### 1. 模型优化

```bash
# 量化模型以减少文件大小
tensorflowjs_converter \\
    --input_format=tf_saved_model \\
    --quantize_uint8 \\
    saved_model \\
    ./optimized_model
```

### 2. 输入尺寸优化

- **640x640**: 标准尺寸，平衡精度和速度
- **416x416**: 更快推理，适度精度损失
- **832x832**: 更高精度，推理较慢

### 3. 批处理设置

```javascript
// 禁用批处理以减少内存使用
const model = await tf.loadGraphModel(modelUrl, {
  fromTFHub: false,
  weightPathPrefix: '',
  onProgress: (fraction, msg) => console.log(fraction, msg)
});
```

## 🔍 故障排除

### 常见问题及解决方案

1. **模型加载失败**
   ```
   错误: Failed to fetch model.json
   解决: 检查文件路径和Web服务器配置
   ```

2. **输入形状不匹配**
   ```
   错误: Input shape mismatch
   解决: 验证模型输入要求，调整预处理代码
   ```

3. **推理结果异常**
   ```
   错误: 检测结果为空或错误
   解决: 检查后处理逻辑，确认类别映射正确
   ```

4. **性能问题**
   ```
   问题: 推理速度慢
   解决: 启用WebGL后端，考虑模型量化
   ```

### 调试工具

```javascript
// 启用TensorFlow.js调试
tf.ENV.set('DEBUG', true);

// 查看后端信息
console.log('当前后端:', tf.getBackend());
console.log('可用后端:', tf.engine().backendNames);

// 内存使用监控
console.log('内存使用:', tf.memory());
```

## 📊 模型评估指标

### 评估脚本示例

```python
import json
import numpy as np
from sklearn.metrics import precision_recall_curve

def evaluate_model_performance(predictions, ground_truth):
    \"\"\"评估模型性能\"\"\"
    
    # 计算mAP
    map_50 = calculate_map(predictions, ground_truth, iou_threshold=0.5)
    map_75 = calculate_map(predictions, ground_truth, iou_threshold=0.75)
    
    # 计算推理时间
    inference_times = [pred['inference_time'] for pred in predictions]
    avg_inference_time = np.mean(inference_times)
    
    return {
        'mAP@0.5': map_50,
        'mAP@0.75': map_75,
        'avg_inference_time_ms': avg_inference_time,
        'total_detections': len(predictions)
    }
```

## 🚀 部署检查清单

- [ ] 模型文件完整 (model.json + .bin文件)
- [ ] 模型信息配置正确 (model_info.json)
- [ ] 输入输出形状匹配系统要求
- [ ] 类别映射配置完整
- [ ] 价格映射设置正确 (餐盘模型)
- [ ] 模型加载测试通过
- [ ] 推理测试正常
- [ ] 性能满足要求 (<200ms推理时间)
- [ ] 备份原模型文件
- [ ] 更新版本号和文档

## 📞 技术支持

如遇到部署问题，请提供以下信息：

1. 模型来源和训练框架
2. 转换过程和使用的工具版本
3. 错误日志和控制台输出
4. 浏览器版本和设备信息
5. 模型文件大小和结构

---

**更新时间**: 2024年12月  
**适用版本**: v1.0.0+