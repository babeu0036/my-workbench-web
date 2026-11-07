import type { Attachment } from './types'

/**
 * 知识库附件的本地存储。
 *
 * 文件本体放 IndexedDB，不放 localStorage —— 后者只有 5 MB 左右，
 * 一个课件就能撑爆，而且同步时会把整份文件当字符串传上去。
 * localStorage 里只留 `Attachment` 那几个字段（key / 名字 / 大小 / MIME），
 * 所以换台设备能看到记录，但文件不跟过去，点开会提示「文件不在这台设备上」。
 *
 * 全程不抛异常：浏览器不支持、配额满了、用户清了站点数据，
 * 一律当成「没存上 / 取不到」，由页面给一句人话，不把错误甩到控制台。
 */

const DB_NAME = 'workbench-files'
const STORE = 'files'
const DB_VERSION = 1

/** 单个文件上限。课程 PPT 一般几 MB，20 MB 足够；再大就不该塞浏览器了 */
export const MAX_FILE_SIZE = 20 * 1024 * 1024

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase | null>(resolve => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })

  return dbPromise
}

/**
 * 跑一次单条操作。没有主键表，key 由调用方给（`put(value, key)` / `get(key)`）。
 * 任何一步失败都返回 null，调用方只需要判空。
 */
async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb()
  if (!db) return null

  return new Promise<T | null>(resolve => {
    try {
      const transaction = db.transaction(STORE, mode)
      const request = action(transaction.objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      transaction.onabort = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** 存一份文件。返回 false 表示没存上（不支持 / 配额满），页面据此拦住提交 */
export async function putAttachment(key: string, file: Blob): Promise<boolean> {
  const db = await openDb()
  if (!db) return false

  // 写入成功要看事务 complete，而不是 put 的 onsuccess ——
  // 后者只代表请求排进队列，配额不足是在提交时才报错的
  return new Promise<boolean>(resolve => {
    try {
      const transaction = db.transaction(STORE, 'readwrite')
      transaction.objectStore(STORE).put(file, key)
      transaction.oncomplete = () => resolve(true)
      transaction.onerror = () => resolve(false)
      transaction.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/** 取回文件本体；没有 / 取不到都是 null */
export async function getAttachment(key: string): Promise<Blob | null> {
  const result = await run<Blob>('readonly', store => store.get(key))
  return result instanceof Blob ? result : null
}

/** 删一份文件。本来就没有也算成功，删记录、换附件都能无脑调 */
export async function deleteAttachment(key: string): Promise<void> {
  await run('readwrite', store => store.delete(key))
}

/** 附件主键：带时间戳，方便在 IndexedDB 里看出先后；随机尾巴防同一毫秒撞车 */
export function newAttachmentKey(now: number = Date.now()): string {
  return `k-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/* ---------- 展示 ---------- */

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

/** 从 File 里抽元信息。key 用调用方给的，方便先建 key 再决定存不存 */
export function attachmentFromFile(file: File, key = newAttachmentKey()): Attachment {
  return {
    key,
    name: file.name || '未命名文件',
    size: file.size,
    mime: file.type || '',
  }
}

/** 读盘校验：缺 key、缺名字、大小不是数字的一律当没有附件 */
export function isAttachment(value: unknown): value is Attachment {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<Attachment>
  return (
    typeof item.key === 'string' &&
    item.key.trim().length > 0 &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    typeof item.size === 'number' &&
    Number.isFinite(item.size) &&
    item.size >= 0 &&
    typeof item.mime === 'string'
  )
}

/** 存进记录前归一：名字去掉首尾空格，MIME 缺了用空串，其余原样 */
export function normalizeAttachment(value: unknown): Attachment | undefined {
  if (!isAttachment(value)) return undefined
  const name = value.name.trim()
  if (!name) return undefined
  return {
    key: value.key,
    name,
    size: value.size,
    mime: value.mime,
  }
}
