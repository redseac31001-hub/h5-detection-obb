#!/usr/bin/env node

/**
 * 模型替换脚本
 * 用于替换现有的YOLO模型文件
 * 
 * 使用方法:
 * node replace_model.js --type face --model /path/to/new/model.json
 * node replace_model.js --type plate --model /path/to/new/model/directory
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

class ModelReplacer {
  constructor() {
    this.modelsDir = path.resolve(__dirname, '../public/models')
    this.supportedTypes = ['face', 'plate']
  }

  validateModelFiles(modelPath) {
    const requiredFiles = ['model.json']
    const modelDir = path.dirname(modelPath)
    
    // 检查必需文件
    for (const file of requiredFiles) {
      const filePath = path.join(modelDir, file)
      if (!fs.existsSync(filePath)) {
        throw new Error(`缺少必需文件: ${file}`)
      }
    }

    // 检查权重文件
    const files = fs.readdirSync(modelDir)
    const binFiles = files.filter(f => f.endsWith('.bin'))
    
    if (binFiles.length === 0) {
      throw new Error('未找到权重文件 (.bin)')
    }

    console.log(`✓ 模型文件验证通过`)
    console.log(`  - 模型配置: model.json`)
    console.log(`  - 权重文件: ${binFiles.join(', ')}`)

    return true
  }

  async validateModelStructure(modelPath) {
    try {
      console.log('验证模型结构...')
      
      // 读取模型配置
      const modelConfig = JSON.parse(fs.readFileSync(modelPath, 'utf8'))
      
      // 检查基本结构
      if (!modelConfig.modelTopology) {
        throw new Error('无效的模型配置: 缺少 modelTopology')
      }
      
      if (!modelConfig.weightsManifest) {
        throw new Error('无效的模型配置: 缺少 weightsManifest')
      }

      // 检查输入输出签名
      if (modelConfig.signature) {
        const { inputs, outputs } = modelConfig.signature
        if (inputs && outputs) {
          console.log('✓ 模型签名验证通过')
          console.log(`  输入: ${JSON.stringify(inputs)}`)
          console.log(`  输出: ${JSON.stringify(outputs)}`)
        }
      }

      return true
    } catch (error) {
      throw new Error(`模型结构验证失败: ${error.message}`)
    }
  }

  backupExistingModel(modelType) {
    const targetDir = path.join(this.modelsDir, `${modelType}_detection_model`)
    const backupDir = path.join(this.modelsDir, `${modelType}_detection_model_backup_${Date.now()}`)
    
    if (fs.existsSync(targetDir)) {
      console.log(`备份现有模型到: ${backupDir}`)
      fs.renameSync(targetDir, backupDir)
      return backupDir
    }
    
    return null
  }

  copyModelFiles(sourcePath, modelType) {
    const sourceDir = path.dirname(sourcePath)
    const targetDir = path.join(this.modelsDir, `${modelType}_detection_model`)
    
    // 创建目标目录
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    
    // 复制所有文件
    const files = fs.readdirSync(sourceDir)
    
    for (const file of files) {
      const sourceFile = path.join(sourceDir, file)
      const targetFile = path.join(targetDir, file)
      
      if (fs.statSync(sourceFile).isFile()) {
        fs.copyFileSync(sourceFile, targetFile)
        console.log(`✓ 复制文件: ${file}`)
      }
    }
    
    return targetDir
  }

  updateModelInfo(modelType, modelPath, customInfo = {}) {
    const modelDir = path.dirname(modelPath)
    const targetDir = path.join(this.modelsDir, `${modelType}_detection_model`)
    const infoPath = path.join(targetDir, 'model_info.json')
    
    // 尝试读取源模型信息
    let modelInfo = {}
    const sourceInfoPath = path.join(modelDir, 'model_info.json')
    
    if (fs.existsSync(sourceInfoPath)) {
      modelInfo = JSON.parse(fs.readFileSync(sourceInfoPath, 'utf8'))
      console.log('✓ 使用源模型信息文件')
    } else {
      // 生成默认模型信息
      modelInfo = this.generateDefaultModelInfo(modelType)
      console.log('✓ 生成默认模型信息')
    }
    
    // 合并自定义信息
    modelInfo = { ...modelInfo, ...customInfo }
    
    // 更新时间戳
    modelInfo.updated_at = new Date().toISOString()
    
    // 写入模型信息文件
    fs.writeFileSync(infoPath, JSON.stringify(modelInfo, null, 2))
    console.log(`✓ 更新模型信息: ${infoPath}`)
    
    return modelInfo
  }

  generateDefaultModelInfo(modelType) {
    const baseInfo = {
      version: "1.0.0",
      updated_at: new Date().toISOString(),
      input_shape: [1, 640, 640, 3],
      confidence_threshold: 0.5,
      iou_threshold: 0.4,
      preprocessing: {
        normalize: true,
        mean: [0, 0, 0],
        std: [255, 255, 255]
      },
      postprocessing: {
        format: "yolo",
        bbox_format: "xywh_center"
      }
    }

    if (modelType === 'face') {
      return {
        ...baseInfo,
        name: "Custom Face Detection Model",
        description: "自定义人脸检测模型",
        classes: ["face"],
        output_shape: [1, 25200, 6],
        max_detections: 10,
        postprocessing: {
          ...baseInfo.postprocessing,
          output_format: "[x, y, w, h, confidence, class]"
        }
      }
    } else if (modelType === 'plate') {
      return {
        ...baseInfo,
        name: "Custom Food Detection Model", 
        description: "自定义餐盘和食物检测模型",
        classes: ["plate", "bowl", "food", "drink"],
        output_shape: [1, 25200, 85],
        max_detections: 20,
        confidence_threshold: 0.6,
        price_mapping: {
          "plate": 0,
          "bowl": 0, 
          "food": 15.0,
          "drink": 8.0
        },
        postprocessing: {
          ...baseInfo.postprocessing,
          output_format: "[x, y, w, h, confidence, class1_prob, class2_prob, ...]"
        }
      }
    }
    
    return baseInfo
  }

  async replaceModel(modelType, modelPath, options = {}) {
    try {
      console.log(`\n开始替换 ${modelType} 检测模型...`)
      console.log(`源模型路径: ${modelPath}`)
      
      // 验证参数
      if (!this.supportedTypes.includes(modelType)) {
        throw new Error(`不支持的模型类型: ${modelType}`)
      }
      
      if (!fs.existsSync(modelPath)) {
        throw new Error(`模型文件不存在: ${modelPath}`)
      }
      
      // 验证模型文件
      this.validateModelFiles(modelPath)
      await this.validateModelStructure(modelPath)
      
      // 备份现有模型
      const backupPath = this.backupExistingModel(modelType)
      if (backupPath) {
        console.log(`✓ 已备份现有模型`)
      }
      
      // 复制新模型文件
      const targetDir = this.copyModelFiles(modelPath, modelType)
      console.log(`✓ 模型文件复制完成: ${targetDir}`)
      
      // 更新模型信息
      const modelInfo = this.updateModelInfo(modelType, modelPath, options.modelInfo)
      
      console.log(`\n✅ 模型替换成功!`)
      console.log(`模型类型: ${modelType}`)
      console.log(`模型名称: ${modelInfo.name}`)
      console.log(`模型版本: ${modelInfo.version}`)
      console.log(`目标目录: ${targetDir}`)
      
      if (backupPath) {
        console.log(`\n💡 如需回滚，请运行:`)
        console.log(`   node replace_model.js --rollback ${path.basename(backupPath)}`)
      }
      
      console.log(`\n🔄 请重启应用以加载新模型`)
      
    } catch (error) {
      console.error(`\n❌ 模型替换失败: ${error.message}`)
      process.exit(1)
    }
  }

  listBackups() {
    const backups = fs.readdirSync(this.modelsDir)
      .filter(dir => dir.includes('_backup_'))
      .map(dir => {
        const stat = fs.statSync(path.join(this.modelsDir, dir))
        return {
          name: dir,
          created: stat.birthtime,
          size: this.getDirSize(path.join(this.modelsDir, dir))
        }
      })
      .sort((a, b) => b.created - a.created)
    
    if (backups.length === 0) {
      console.log('未找到备份文件')
      return
    }
    
    console.log('\n📦 可用的模型备份:')
    backups.forEach((backup, index) => {
      console.log(`${index + 1}. ${backup.name}`)
      console.log(`   创建时间: ${backup.created.toLocaleString()}`)
      console.log(`   大小: ${(backup.size / 1024 / 1024).toFixed(2)} MB\n`)
    })
  }

  getDirSize(dirPath) {
    let size = 0
    const files = fs.readdirSync(dirPath)
    
    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isFile()) {
        size += stat.size
      }
    }
    
    return size
  }
}

// 命令行接口
function main() {
  const args = process.argv.slice(2)
  const replacer = new ModelReplacer()
  
  if (args.includes('--help') || args.length === 0) {
    console.log(`
YOLO模型替换工具

使用方法:
  node replace_model.js --type <face|plate> --model <path>
  node replace_model.js --list-backups
  node replace_model.js --help

选项:
  --type          模型类型 (face 或 plate)
  --model         新模型的路径 (model.json文件路径)
  --list-backups  列出所有备份
  --help          显示帮助信息

示例:
  node replace_model.js --type face --model ./my_face_model/model.json
  node replace_model.js --type plate --model ./my_food_model/model.json
    `)
    return
  }
  
  if (args.includes('--list-backups')) {
    replacer.listBackups()
    return
  }
  
  const typeIndex = args.indexOf('--type')
  const modelIndex = args.indexOf('--model')
  
  if (typeIndex === -1 || modelIndex === -1) {
    console.error('❌ 缺少必需参数 --type 和 --model')
    process.exit(1)
  }
  
  const modelType = args[typeIndex + 1]
  const modelPath = path.resolve(args[modelIndex + 1])
  
  replacer.replaceModel(modelType, modelPath)
}

if (require.main === module) {
  main()
}

module.exports = ModelReplacer