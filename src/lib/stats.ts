import { dayKey, weekEnd, weekStart } from './date'
import { weekTotals } from './todos'
import type { Todo } from './types'

/**
 * 复盘「数据」页的只读指标。
 * 都接受 now，方便固定时间做测试；也都不改数据，删掉的任务自然不再计入。
 */
export { weekTotals }

/** 所有完成时间的时间戳，坏值先剔掉 */
function doneTimes(todos: Todo[]): number[] {
  return todos
    .map(todo => todo.doneAt)
    .filter((ts): ts is number => typeof ts === 'number' && Number.isFinite(ts))
}

/** 本周有完成任务的不同日期数，满分 7 */
export function activeDays(todos: Todo[], now: number = Date.now()): number {
  const start = weekStart(now)
  const end = weekEnd(now)
  const days = new Set(doneTimes(todos).filter(ts => ts >= start && ts < end).map(ts => dayKey(ts)))
  return days.size
}

/**
 * 连续有完成的天数。
 *
 * 「今天还没完成」不算断档：只要昨天有完成，就从昨天起算。
 * 否则每天零点一过数字就归零，早上打开先被打击一次。
 * 今天和昨天都没有完成，才是 0。
 */
export function streak(todos: Todo[], now: number = Date.now()): number {
  const days = new Set(doneTimes(todos).map(ts => dayKey(ts)))
  if (days.size === 0) return 0

  const today = new Date(now)
  // 第 n 天 00:00，用年月日构造，不受夏令时影响
  const dayShift = (n: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + n).getTime()

  let cursor = 0
  if (!days.has(dayKey(dayShift(0)))) {
    if (!days.has(dayKey(dayShift(-1)))) return 0
    cursor = -1
  }

  let count = 0
  while (days.has(dayKey(dayShift(cursor)))) {
    count += 1
    cursor -= 1
  }
  return count
}

/** 柱状图上写一个字就够，两个字的「周一」在 360px 下会挤 */
const WEEKDAY_CHARS = ['日', '一', '二', '三', '四', '五', '六']

export type DayCount = {
  /** 本地日期键，当 key 用 */
  key: string
  /** 日 / 一 / 二 …，柱子下面那一行 */
  weekday: string
  count: number
  /** 今天那根柱子要高亮 */
  isToday: boolean
}

/**
 * 最近 N 天每天完成了几条，按日期升序，最后一项是今天。
 *
 * 这是「滚动 7 天」而不是「本周 7 天」：周日看它就是上周一到今天，
 * 所以数字可能和「本周完成」对不上，两者本来就在回答不同的问题。
 */
export function dailyCounts(todos: Todo[], now: number = Date.now(), days = 7): DayCount[] {
  const counter = new Map<string, number>()
  for (const ts of doneTimes(todos)) {
    const key = dayKey(ts)
    counter.set(key, (counter.get(key) ?? 0) + 1)
  }

  const base = new Date(now)
  const todayKey = dayKey(now)
  const out: DayCount[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    // 用年月日回退，跨月、跨年都不会偏
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i)
    const key = dayKey(d.getTime())
    out.push({
      key,
      weekday: WEEKDAY_CHARS[d.getDay()],
      count: counter.get(key) ?? 0,
      isToday: key === todayKey,
    })
  }
  return out
}
