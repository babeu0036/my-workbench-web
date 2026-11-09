/**
 * 附件预览方式：PDF / 图片 / Word(docx) / 其他 Office / 其余。
 *
 * 判断只按文件名后缀 + MIME 两种，MIME 优先 —— 有些系统上传时
 * `File.type` 是空的，只看 MIME 会把 PDF 当成「看不了」。
 *
 * docx 用 mammoth 在浏览器里转成 HTML，**动态 import**：
 * 只在真的点开一个 Word 文件时才下载那 100 多 KB，不影响首屏。
 *
 * 其余 Office（.doc / .xls(x) / .ppt(x)）不自己解析，交给微软的在线查看器：
 * 它只认公网可访问的地址，所以必须走 bucket 的公开链接。
 */

export type PreviewKind = 'pdf' | 'image' | 'docx' | 'office' | 'other'

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * 塞给微软 Office 在线查看器的后缀：老版 .doc/.xls/.ppt 和 .xlsx/.pptx。
 * `.docx` 不在里面 —— 它自己走 mammoth，不绕远路去外面转一圈。
 */
const OFFICE_EXT = ['doc', 'xls', 'xlsx', 'ppt', 'pptx']

/** 对应的 MIME。上传时 File.type 为空的情况不少，后缀认不出的还有这一道 */
const OFFICE_MIME = [
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

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
  // 必须排在 docx 之后：有些系统给 .docx 报的也是 application/msword
  if (OFFICE_MIME.includes(mime) || OFFICE_EXT.includes(ext)) return 'office'
  return 'other'
}

/** 微软在线查看器的入口，后面拼 URL 编码过的文件地址 */
export const OFFICE_VIEWER = 'https://view.officeapps.live.com/op/embed.aspx?src='

/**
 * 把公开地址塞给微软查看器。
 *
 * 只编码一次：`encodeURIComponent` 之后整串直接拼上去，
 * 不要再对结果二次编码，否则 `%2F` 会变成 `%252F`，那边一律打不开。
 */
export function officeViewerUrl(url: string): string {
  return OFFICE_VIEWER + encodeURIComponent(url)
}

/** 给 iframe 的等待上限：10 秒。卡住的页面不如早点让人去下载 */
export const OFFICE_TIMEOUT = 10_000

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
