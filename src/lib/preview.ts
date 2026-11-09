/**
 * 附件预览方式：PDF / 图片 / Word(docx) / 其余。
 *
 * 判断只按文件名后缀 + MIME 两种，MIME 优先 —— 有些系统上传时
 * `File.type` 是空的，只看 MIME 会把 PDF 当成「看不了」。
 *
 * docx 用 mammoth 在浏览器里转成 HTML，**动态 import**：
 * 只在真的点开一个 Word 文件时才下载那 100 多 KB，不影响首屏。
 */

export type PreviewKind = 'pdf' | 'image' | 'docx' | 'other'

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function previewKind(name: string, type = ''): PreviewKind {
  const mime = type.toLowerCase()
  const ext = extOf(name)

  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('image/') || IMAGE_EXT.includes(ext)) return 'image'
  if (mime === DOCX_MIME || ext === 'docx') return 'docx'
  return 'other'
}

/** 转换超时：15 秒。卡住不如早点说「打不开」 */
export const DOCX_TIMEOUT = 15_000

type Mammoth = {
  convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>
}

/**
 * 把一个在线 docx 转成 HTML 片段。
 *
 * 失败（网络、不是合法 docx、超时）一律抛错，由预览层显示
 * 「打不开」+ 下载兜底 —— 不让用户对着空白页发呆。
 */
export async function docxToHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOCX_TIMEOUT)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`读取失败（${res.status}）`)
    const arrayBuffer = await res.arrayBuffer()

    // mammoth 是 CJS 包，浏览器构建下 default 里才是它
    const mod = (await import('mammoth')) as unknown as Mammoth & { default?: Mammoth }
    const mammoth = mod.default ?? mod
    const result = await mammoth.convertToHtml({ arrayBuffer })
    return result.value
  } finally {
    clearTimeout(timer)
  }
}
