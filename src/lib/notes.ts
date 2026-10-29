import type { Note } from './types'

/** 摘要长度：列表上每条只露前 30 个字 */
export const SUMMARY_LENGTH = 30

/**
 * 新笔记的 id。
 * 正常情况下就是 Date.now()，撞上了（同一毫秒建了两条）就往后挪。
 */
export function createNoteId(notes: Note[]): number {
  const used = new Set(notes.map(n => n.id))
  let id = Date.now()
  while (used.has(id)) id += 1
  return id
}

/**
 * 列表摘要：换行和连续空白压成一个空格，再截前 30 字。
 * 用 Array.from 按码点切，中文和 emoji 都不会被截成半个字。
 */
export function toSummary(content: string, max = SUMMARY_LENGTH): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  const chars = Array.from(flat)
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : flat
}

/** 按更新时间倒序（不改原数组） */
export function sortByUpdatedDesc(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 搜索：内容不区分大小写的包含匹配；关键字为空就返回全部 */
export function filterNotes(notes: Note[], keyword: string): Note[] {
  const kw = keyword.trim().toLowerCase()
  const hit = kw ? notes.filter(n => n.content.toLowerCase().includes(kw)) : notes
  return sortByUpdatedDesc(hit)
}
