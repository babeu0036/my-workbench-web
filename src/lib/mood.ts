import { dayKey, dayKeyOffset, weekKeyOf } from './date'
import type { Mood } from './types'

/**
 * 今日状态（心情）。
 *
 * 存成「日期键 → 心情」的一张表：{ '2026-11-01': 'good' }。
 * 一天只留一条，再点就是覆盖那一条 —— 所以「一天只能选一次、可改」是数据的
 * 天然结果，不是靠界面拦。以前的记录不动，以后想做「这周心情」直接读这张表。
 *
 * 只保留最近 90 天：这张表只增不减会一直长大，而三个月前那天心情好坏
 * 对现在的判断没有帮助，读盘时顺手清掉。
 */

export const MOOD_KEEP_DAYS = 90

/** 三个选项，顺序就是按钮从左到右的顺序。short 是统计行里用的短词 */
export const MOOD_OPTIONS = [
  { value: 'good', emoji: '😄', label: '不错', short: '不错' },
  { value: 'ok', emoji: '😐', label: '一般', short: '一般' },
  { value: 'tired', emoji: '😮‍💨', label: '有点累', short: '累' },
] as const

const VALID: readonly string[] = ['good', 'ok', 'tired']
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export type MoodMap = Record<string, Mood>

function isMood(value: unknown): value is Mood {
  return typeof value === 'string' && VALID.includes(value)
}

/**
 * 读盘时补齐：坏的日期键、不认识的值直接丢；90 天以前的一并清掉。
 * 清掉的只是「过期记录」，今天那条永远在窗口里，不会被误删。
 */
export function normalizeMoods(raw: unknown, now: number = Date.now()): MoodMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const oldest = dayKeyOffset(dayKey(now), -(MOOD_KEEP_DAYS - 1))
  const out: MoodMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!KEY_RE.test(key) || !isMood(value)) continue
    if (key < oldest) continue
    out[key] = value
  }
  return out
}

/** 某天记的是什么；没记过给 null */
export function moodOf(map: MoodMap, key: string): Mood | null {
  const value = map[key]
  return isMood(value) ? value : null
}

/** 记 / 改某天的状态。只动这一天，别的日期原样留着 */
export function setMood(map: MoodMap, key: string, mood: Mood): MoodMap {
  return { ...map, [key]: mood }
}

export type WeekMoodCounts = {
  good: number
  ok: number
  tired: number
  /** 本周一共记了几天，复盘页用它判断「这周还没记状态」 */
  total: number
}

/**
 * 本周（周一到周日）每种状态各几天。
 *
 * 起点必须是本周一 —— 和「本周完成」的 weekTotals 用同一个周一，
 * 不然（比如用最近 7 天）两个数字会差一天，看着像对不上。
 * 只数这 7 个日期键；同一案只留一条，所以天数不会超过 7。
 */
export function weekMoodCounts(map: MoodMap, now: number = Date.now()): WeekMoodCounts {
  const start = weekKeyOf(now)
  const counts: WeekMoodCounts = { good: 0, ok: 0, tired: 0, total: 0 }

  for (let i = 0; i < 7; i += 1) {
    const mood = moodOf(map, dayKeyOffset(start, i))
    if (!mood) continue
    counts[mood] += 1
    counts.total += 1
  }
  return counts
}
