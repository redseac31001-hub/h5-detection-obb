# AI识别系统

基于Vue3 + TypeScript + Pinia技术栈开发的餐厅自助识别系统，支持实时视频流中的人脸识别和餐盘检测，实现智能点餐和人脸支付功能。

## 🚀 技术栈

- **前端框架**: Vue 3.5+ (Composition API)
- **开发语言**: TypeScript 5.8+
- **状态管理**: Pinia 3.0+
- **路由管理**: Vue Router 4.5+
- **UI组件库**: Element Plus 2.4+
- **构建工具**: Vite 7.0+
- **AI推理**: TensorFlow.js 4.15+
- **计算机视觉**: 自定义Canvas处理
- **样式预处理**: Less 4.2+

## ✨ 核心功能

### 🎯 实时检测
- **人脸检测**: 基于YOLO模型的实时人脸识别和追踪
- **餐盘识别**: 智能识别餐盘和菜品，自动计算价格
- **视频流处理**: 高性能的实时视频帧处理和标注

### 💳 人脸支付
- **人脸识别**: 支持用户身份验证
- **支付处理**: 集成人脸支付流程
- **订单管理**: 自动生成和管理订单信息

### ⚙️ 系统设置
- **摄像头配置**: 支持多摄像头切换和参数调节
- **检测参数**: 可调节检测阈值和性能参数
- **模型管理**: 支持自定义AI模型加载和配置

## 🏗️ 项目架构

```
src/
├── components/          # Vue组件
│   ├── CameraView.vue      # 摄像头视图组件
│   ├── FaceDetection.vue   # 人脸检测组件
│   └── PlateDetection.vue  # 餐盘检测组件
├── views/              # 页面组件
│   ├── DetectionView.vue   # 主检测页面
│   ├── FacePaymentView.vue # 人脸支付页面
│   └── SettingsView.vue    # 系统设置页面
├── stores/             # Pinia状态管理
│   ├── detection.ts        # 检测状态Store
│   └── camera.ts          # 摄像头状态Store
├── services/           # 业务服务
│   └── detectionService.ts # 检测服务类
├── utils/              # 工具函数
│   ├── modelLoader.ts      # YOLO模型加载器
│   └── frameProcessor.ts   # 视频帧处理器
├── types/              # TypeScript类型定义
│   └── index.ts           # 全局类型定义
└── router/             # 路由配置
    └── index.ts           # 路由定义
```

## 🛠️ 安装与运行

### 环境要求
- Node.js >= 20.19.0
- 现代浏览器（支持WebRTC和WebGL）
- 摄像头设备

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 类型检查
```bash
npm run type-check
```

### 代码检查
```bash
npm run lint
```

## 🤖 AI模型部署

### 模型要求
系统需要两个YOLO格式的TensorFlow.js模型：

1. **人脸检测模型** (`/public/models/face_detection_model/`)
   - 输入: [1, 640, 640, 3]
   - 输出: [1, N, 6] (x, y, w, h, confidence, class)

2. **餐盘检测模型** (`/public/models/plate_detection_model/`)
   - 输入: [1, 640, 640, 3] 
   - 输出: [1, N, 7] (x, y, w, h, confidence, class, price)

### 模型转换
```bash
# 安装转换工具
npm install -g @tensorflow/tfjs-converter

# 转换PyTorch模型
tensorflowjs_converter \\
    --input_format=tf_saved_model \\
    --output_node_names='Identity,Identity_1,Identity_2' \\
    /path/to/saved_model \\
    /public/models/face_detection_model
```

详细部署说明请参考 `public/models/README.md`

## 🎮 使用指南

### 1. 启动系统
- 访问系统主页，点击"启动摄像头"
- 授权摄像头权限
- 等待AI模型加载完成

### 2. 检测功能
- **人脸检测**: 自动检测和标注视频中的人脸
- **餐盘识别**: 识别餐盘并计算菜品价格
- **实时标注**: 在视频上显示检测结果和置信度

### 3. 人脸支付
- 进入"人脸支付"页面
- 将面部对准摄像头进行识别
- 确认订单信息和支付金额
- 完成支付流程

### 4. 系统设置
- 调整摄像头参数（分辨率、设备选择）
- 配置检测阈值和性能参数
- 管理AI模型路径和配置

## 🔧 开发指南

### 组件开发
```typescript
// 使用Composition API和TypeScript
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDetectionStore } from '@/stores/detection'

const detectionStore = useDetectionStore()
const isDetecting = computed(() => detectionStore.isDetecting)
</script>
```

### 状态管理
```typescript
// Pinia Store示例
export const useDetectionStore = defineStore('detection', () => {
  const detections = ref<DetectionResult[]>([])
  
  function addDetection(detection: DetectionResult) {
    detections.value.push(detection)
  }
  
  return { detections, addDetection }
})
```

### 类型安全
所有组件和服务都使用严格的TypeScript类型检查，确保代码质量和开发效率。

## 🚀 性能优化

### 1. 模型优化
- 使用量化模型减少文件大小
- 启用WebGL后端加速推理
- 实现模型缓存机制

### 2. 渲染优化
- 使用Canvas进行高性能图像处理
- 实现帧率控制和内存管理
- 优化检测频率和队列处理

### 3. 用户体验
- 实现加载状态和错误处理
- 支持离线模式和渐进式加载
- 响应式设计适配不同设备

## 🔒 安全考虑

- 摄像头权限管理
- 用户数据本地处理
- 模型文件完整性验证
- 支付信息安全传输

## 🤝 贡献指南

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🆘 故障排除

### 常见问题

1. **摄像头无法启动**
   - 检查浏览器权限设置
   - 确认摄像头设备连接正常
   - 尝试刷新页面重新授权

2. **模型加载失败**
   - 验证模型文件路径正确
   - 检查网络连接和服务器配置
   - 查看浏览器控制台错误信息

3. **检测效果不佳**
   - 调整检测阈值参数
   - 确保光线充足和图像清晰
   - 检查模型质量和训练数据

### 调试工具
- 浏览器开发者工具
- Vue DevTools扩展
- TensorFlow.js性能分析器

## 📞 技术支持

如遇问题请提供以下信息：
- 浏览器版本和操作系统
- 错误日志和控制台输出  
- 复现步骤和预期行为
- 设备和摄像头信息

---

**开发团队**: 前端AI系统开发组  
**更新时间**: 2024年12月  
**版本**: v1.0.0