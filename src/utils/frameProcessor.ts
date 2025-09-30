export class FrameProcessor {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.canvas = document.createElement('canvas')
    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      throw new Error('无法创建Canvas上下文')
    }
    this.ctx = ctx
  }

  cropRegion(
    sourceCanvas: HTMLCanvasElement,
    x: number,
    y: number,
    width: number,
    height: number
  ): HTMLCanvasElement {
    const cropCanvas = document.createElement('canvas')
    const cropCtx = cropCanvas.getContext('2d')
    
    if (!cropCtx) {
      throw new Error('无法创建裁剪Canvas上下文')
    }

    cropCanvas.width = width
    cropCanvas.height = height

    cropCtx.drawImage(
      sourceCanvas,
      x, y, width, height,
      0, 0, width, height
    )

    return cropCanvas
  }

  resizeFrame(
    sourceCanvas: HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number
  ): HTMLCanvasElement {
    const resizeCanvas = document.createElement('canvas')
    const resizeCtx = resizeCanvas.getContext('2d')
    
    if (!resizeCtx) {
      throw new Error('无法创建缩放Canvas上下文')
    }

    resizeCanvas.width = targetWidth
    resizeCanvas.height = targetHeight

    resizeCtx.drawImage(
      sourceCanvas,
      0, 0, sourceCanvas.width, sourceCanvas.height,
      0, 0, targetWidth, targetHeight
    )

    return resizeCanvas
  }

  applyFilter(
    sourceCanvas: HTMLCanvasElement,
    filterType: 'grayscale' | 'blur' | 'brightness' | 'contrast'
  ): HTMLCanvasElement {
    const filterCanvas = document.createElement('canvas')
    const filterCtx = filterCanvas.getContext('2d')
    
    if (!filterCtx) {
      throw new Error('无法创建滤镜Canvas上下文')
    }

    filterCanvas.width = sourceCanvas.width
    filterCanvas.height = sourceCanvas.height

    switch (filterType) {
      case 'grayscale':
        filterCtx.filter = 'grayscale(100%)'
        break
      case 'blur':
        filterCtx.filter = 'blur(2px)'
        break
      case 'brightness':
        filterCtx.filter = 'brightness(120%)'
        break
      case 'contrast':
        filterCtx.filter = 'contrast(120%)'
        break
    }

    filterCtx.drawImage(sourceCanvas, 0, 0)
    
    // 重置滤镜
    filterCtx.filter = 'none'

    return filterCanvas
  }

  extractImageData(canvas: HTMLCanvasElement): ImageData {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('无法获取Canvas上下文')
    }
    
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  createImageDataFromArray(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): ImageData {
    return new ImageData(data, width, height)
  }

  convertToBlob(canvas: HTMLCanvasElement, type: string = 'image/png'): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('无法转换为Blob'))
        }
      }, type)
    })
  }

  downloadImage(canvas: HTMLCanvasElement, filename: string) {
    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL()
    link.click()
  }

  // 批量处理多个检测区域
  batchCropRegions(
    sourceCanvas: HTMLCanvasElement,
    regions: Array<{ x: number; y: number; width: number; height: number; id: string }>
  ): Array<{ id: string; canvas: HTMLCanvasElement }> {
    return regions.map(region => ({
      id: region.id,
      canvas: this.cropRegion(sourceCanvas, region.x, region.y, region.width, region.height)
    }))
  }

  // 创建缩略图
  createThumbnail(
    sourceCanvas: HTMLCanvasElement,
    maxWidth: number = 150,
    maxHeight: number = 150
  ): HTMLCanvasElement {
    const { width, height } = sourceCanvas
    let newWidth = width
    let newHeight = height

    // 计算缩略图尺寸，保持宽高比
    if (width > height) {
      if (width > maxWidth) {
        newWidth = maxWidth
        newHeight = (height * maxWidth) / width
      }
    } else {
      if (height > maxHeight) {
        newHeight = maxHeight
        newWidth = (width * maxHeight) / height
      }
    }

    return this.resizeFrame(sourceCanvas, newWidth, newHeight)
  }

  // 添加文本标注
  addTextAnnotation(
    canvas: HTMLCanvasElement,
    text: string,
    x: number,
    y: number,
    options: {
      fontSize?: number
      fontFamily?: string
      color?: string
      backgroundColor?: string
      padding?: number
    } = {}
  ): HTMLCanvasElement {
    const annotatedCanvas = document.createElement('canvas')
    const ctx = annotatedCanvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('无法创建标注Canvas上下文')
    }

    annotatedCanvas.width = canvas.width
    annotatedCanvas.height = canvas.height

    // 复制原始图像
    ctx.drawImage(canvas, 0, 0)

    // 设置文本样式
    const fontSize = options.fontSize || 16
    const fontFamily = options.fontFamily || 'Arial'
    const color = options.color || '#fff'
    const backgroundColor = options.backgroundColor || 'rgba(0,0,0,0.7)'
    const padding = options.padding || 4

    ctx.font = `${fontSize}px ${fontFamily}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    // 测量文本尺寸
    const textMetrics = ctx.measureText(text)
    const textWidth = textMetrics.width
    const textHeight = fontSize

    // 绘制背景
    ctx.fillStyle = backgroundColor
    ctx.fillRect(
      x - padding,
      y - padding,
      textWidth + padding * 2,
      textHeight + padding * 2
    )

    // 绘制文本
    ctx.fillStyle = color
    ctx.fillText(text, x, y)

    return annotatedCanvas
  }

  // 添加边界框标注
  addBoundingBox(
    canvas: HTMLCanvasElement,
    bbox: { x: number; y: number; width: number; height: number },
    options: {
      strokeColor?: string
      strokeWidth?: number
      fillColor?: string
      dashPattern?: number[]
    } = {}
  ): HTMLCanvasElement {
    const annotatedCanvas = document.createElement('canvas')
    const ctx = annotatedCanvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('无法创建标注Canvas上下文')
    }

    annotatedCanvas.width = canvas.width
    annotatedCanvas.height = canvas.height

    // 复制原始图像
    ctx.drawImage(canvas, 0, 0)

    // 设置边界框样式
    const strokeColor = options.strokeColor || '#00ff00'
    const strokeWidth = options.strokeWidth || 2
    const fillColor = options.fillColor
    const dashPattern = options.dashPattern

    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth

    if (dashPattern) {
      ctx.setLineDash(dashPattern)
    }

    // 绘制边界框
    if (fillColor) {
      ctx.fillStyle = fillColor
      ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height)
    }

    ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height)

    // 重置线条样式
    ctx.setLineDash([])

    return annotatedCanvas
  }

  // 合并多个Canvas
  mergeCanvases(canvases: HTMLCanvasElement[]): HTMLCanvasElement {
    if (canvases.length === 0) {
      throw new Error('Canvas数组为空')
    }

    const mergedCanvas = document.createElement('canvas')
    const ctx = mergedCanvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('无法创建合并Canvas上下文')
    }

    // 使用第一个Canvas的尺寸
    const firstCanvas = canvases[0]
    mergedCanvas.width = firstCanvas.width
    mergedCanvas.height = firstCanvas.height

    // 依次绘制所有Canvas
    canvases.forEach(canvas => {
      ctx.drawImage(canvas, 0, 0)
    })

    return mergedCanvas
  }

  dispose() {
    // 清理资源（如果需要）
  }
}