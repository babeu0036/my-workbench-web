/**
 * 图片上传前的压缩：长边不超过 1600px，输出 JPEG 质量 0.8。
 *
 * 为什么只压 JPEG 和 PNG：截图、照片基本就这两种，而这俩最容易是几 MB 的
 * 大图塞进 10 MB 的上限里。GIF（可能是动图）和 WebP 一律不碰。
 *
 * 三个必须记住的细节：
 * - PNG 可能带透明区，JPEG 没有透明通道，不先铺白底会变成黑块；
 * - 缩小后如果反而更大（小图、已经是高质量 JPEG），保留原文件，
 *   别为了「统一格式」把一张 20 KB 的图重编码成 30 KB；
 * - 解码失败（文件其实不是图片）就原样返回，交给后面的 10 MB 校验。
 *
 * 内容是什么格式，名字就写什么格式：转成 JPEG 之后文件名后缀也改成 .jpg，
 * 不出现「叫 .png、内容是 jpeg」这种别扭组合。
 */

/** 长边上限。1600 足够在卡片和预览层里看清，又不至于几 MB */
export const MAX_IMAGE_EDGE = 1600

/** JPEG 输出质量。0.8 是肉眼几乎无损、体积掉一半的位置 */
export const JPEG_QUALITY = 0.8

/** 只处理这两种 */
const COMPRESSIBLE = ['image/jpeg', 'image/png']

export function isCompressible(type: string): boolean {
  return COMPRESSIBLE.includes((type || '').toLowerCase())
}

/** 按长边等比缩放；本来就在范围内就不放大，直接返回原尺寸 */
export function fitSize(
  width: number,
  height: number,
  max: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const long = Math.max(width, height)
  if (!Number.isFinite(long) || long <= 0) return { width: 1, height: 1 }
  if (long <= max) return { width: Math.round(width), height: Math.round(height) }

  const scale = max / long
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** 换后缀成 .jpg：`课表.png` → `课表.jpg`，没后缀的直接补上 */
export function jpegName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  return `${base || 'image'}.jpg`
}

/**
 * 压缩一张图。失败或没变小就返回原文件，**不抛错** ——
 * 用户选的是一张图，这里挂掉不该让整个添加流程停住。
 */
export async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    // 先记下原尺寸：close() 之后再去读 width 是不保险的
    const sourceWidth = bitmap.width
    const sourceHeight = bitmap.height
    const size = fitSize(sourceWidth, sourceHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return file
    }

    // 先铺白底，PNG 的透明区域才不会在 JPEG 里变成黑块
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })
    if (!blob) return file

    // 尺寸没动、体积也没降：没必要换成一份更差的 JPEG
    const resized = size.width !== sourceWidth || size.height !== sourceHeight
    if (!resized && blob.size >= file.size) return file

    return new File([blob], jpegName(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}
