# AI模型部署说明

## 模型文件结构

```
public/models/
├── face_detection_model/
│   ├── model.json          # 人脸检测模型配置文件
│   ├── group1-shard1of1.bin # 模型权重文件
│   └── README.md           # 模型说明
├── plate_detection_model/
│   ├── model.json          # 餐盘检测模型配置文件
│   ├── group1-shard1of1.bin # 模型权重文件
│   └── README.md           # 模型说明
└── README.md               # 本文件
```

## 模型要求

### 人脸检测模型
- **格式**: TensorFlow.js Graph Model
- **输入**: [1, 640, 640, 3] RGB图像
- **输出**: [1, N, 6] 检测结果 (x, y, w, h, confidence, class)
- **类别**: 0=face

### 餐盘检测模型  
- **格式**: TensorFlow.js Graph Model
- **输入**: [1, 640, 640, 3] RGB图像
- **输出**: [1, N, 7] 检测结果 (x, y, w, h, confidence, class_id, dish_price)
- **类别**: 0=plate, 1=dish, 2=food

## 模型部署步骤

### 1. 准备YOLO模型

如果您有PyTorch或Darknet格式的YOLO模型，请先转换为TensorFlow SavedModel格式：

```python
# 使用YOLOv5转换示例
import torch

# 加载PyTorch模型
model = torch.hub.load('ultralytics/yolov5', 'custom', path='your_model.pt')

# 导出为TensorFlow SavedModel
model.export(format='saved_model')
```

### 2. 转换为TensorFlow.js格式

```bash
# 安装tensorflowjs转换工具
npm install -g @tensorflow/tfjs-converter

# 转换模型
tensorflowjs_converter \
    --input_format=tf_saved_model \
    --output_node_names='Identity,Identity_1,Identity_2' \
    --saved_model_tags=serve \
    ./saved_model \
    ./public/models/face_detection_model
```

### 3. 验证模型文件

确保每个模型文件夹包含：
- `model.json` - 模型架构和元数据
- `group1-shard1of1.bin` - 模型权重（可能有多个分片）

### 4. 测试模型加载

在浏览器开发者工具中测试：

```javascript
// 测试人脸检测模型
const faceModel = await tf.loadGraphModel('/models/face_detection_model/model.json');
console.log('人脸模型输入形状:', faceModel.inputs[0].shape);
console.log('人脸模型输出形状:', faceModel.outputs[0].shape);

// 测试餐盘检测模型  
const plateModel = await tf.loadGraphModel('/models/plate_detection_model/model.json');
console.log('餐盘模型输入形状:', plateModel.inputs[0].shape);
console.log('餐盘模型输出形状:', plateModel.outputs[0].shape);
```

## 模型性能优化

### 1. 量化模型
```bash
tensorflowjs_converter \
    --input_format=tf_saved_model \
    --quantize_uint8 \
    ./saved_model \
    ./public/models/face_detection_model
```

### 2. 模型分片
大模型会自动分片，确保Web服务器支持Range请求以实现并行下载。

## 故障排除

### 常见问题

1. **模型加载失败**
   - 检查模型文件路径是否正确
   - 确认Web服务器可以访问模型文件
   - 检查浏览器CORS设置

2. **推理结果异常**
   - 验证输入图像预处理是否正确
   - 检查模型输出格式是否匹配代码预期
   - 确认类别映射是否正确

3. **性能问题**
   - 启用WebGL后端: `tf.setBackend('webgl')`
   - 考虑使用模型量化
   - 调整输入图像尺寸

### 调试工具

使用浏览器开发者工具查看：
- Network标签页：模型文件加载状态
- Console：TensorFlow.js日志和错误
- Performance：模型推理性能分析

## 联系支持

如需帮助，请提供：
- 模型文件信息（大小、格式等）
- 浏览器和TensorFlow.js版本
- 完整的错误日志
- 复现步骤