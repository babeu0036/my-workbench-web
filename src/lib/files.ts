import { FEED_KEY, FEED_URL } from './feed'

/**
 * 知识库附件：直接传 Supabase Storage 的 public bucket `files`。
 *
 * 为什么不放浏览器本地了：IndexedDB 里的文件换台设备就打不开，
 * 云同步只搬 localStorage，等于附件永远困在一台机器上。
 *
 * 这个 bucket 是 public 的 —— **拿到链接的人都能看**，
 * 所以表单里得提醒一句「别传证件」。上传用 publishable key（anon），
 * service_role 绝不进来；bucket 那边要给 anon 开 INSERT 策略。
 *
 * 除 `uploadFile` 之外都是纯函数，能单独跑测试。
 */

/** 单个文件上限 10 MB。再大的课件建议放网盘，这里记个链接 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

/** bucket 名，建在 Supabase 后台的 Storage 里，必须是 public */
export const FILES_BUCKET = 'files'

/** 1.2 MB / 860 KB / 512 B，两种单位之间不出现 1024 KB 这种 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '未知大小'
  if (bytes < 1024) return `${Math.round(bytes)} B`

  const kb = bytes / 1024
  if (kb < 1024) {
    const value = kb < 10 ? kb.toFixed(1) : String(Math.round(kb))
    return `${trimZero(value)} KB`
  }

  const mb = kb / 1024
  const value = mb < 10 ? mb.toFixed(1) : String(Math.round(mb))
  return `${trimZero(value)} MB`
}

function trimZero(value: string): string {
  return value.endsWith('.0') ? value.slice(0, -2) : value
}

/**
 * 对象路径：`{时间戳}-{随机串}-{文件名的 ASCII 版}`。
 *
 * 时间戳让人在后台一眼看出先后，随机串防同一毫秒同名撞车。
 *
 * 为什么不是原文件名：Supabase Storage 的 key 只收 ASCII，
 * 直接传「高数复习手册.pdf」会 400 InvalidKey（实测）。
 * 所以路径里换成安全名，**记录里的 fileName 仍是原名**，
 * 列表显示和下载时的文件名都不受影响。
 */
export function fileObjectPath(
  file: { name: string },
  now: number = Date.now(),
  rand: string = Math.random().toString(36).slice(2, 8),
): string {
  return `${now}-${rand}-${asciiName(file.name || '未命名文件')}`
}

/** 只留 ASCII 字母数字和 . _ -，连续下划线合成一个；中文名退化成 file.ext */
function asciiName(name: string): string {
  const dot = name.lastIndexOf('.')
  const rawBase = dot > 0 ? name.slice(0, dot) : name
  const rawExt = dot > 0 ? name.slice(dot + 1) : ''

  const base = rawBase
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '')
  const ext = rawExt.replace(/[^A-Za-z0-9]/g, '')

  return ext ? `${base || 'file'}.${ext}` : base || 'file'
}

/** 路径里可能有空格和中文，逐段转义；斜杠要留着当分隔符 */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

/** 公开访问地址：bucket 是 public，任何人拿到这个链接都能打开 */
export function publicFileUrl(path: string): string {
  return `${FEED_URL}/storage/v1/object/public/${FILES_BUCKET}/${encodePath(path)}`
}

/**
 * 传一个文件，返回它的对象路径和公开地址。
 *
 * 失败一律抛错，由表单显示一句人话，不把半截状态写进记录 ——
 * 记录里存了 fileUrl 但文件其实没传上去，点开就是 404，比报错更难查。
 */
export async function uploadFile(file: File): Promise<{ path: string; url: string }> {
  const path = fileObjectPath(file)
  const res = await fetch(`${FEED_URL}/storage/v1/object/${FILES_BUCKET}/${encodePath(path)}`, {
    method: 'POST',
    headers: {
      apikey: FEED_KEY,
      Authorization: `Bearer ${FEED_KEY}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
      'cache-control': '3600',
    },
    body: file,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`上传失败（${res.status}）${detail.slice(0, 200)}`)
  }

  return { path, url: publicFileUrl(path) }
}
