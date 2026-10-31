import { dayKey, weekEnd, weekStart } from './date'
import { weekTotals } from './todos'
import type { Todo } from './types'

/**
 * 复盘的三个只读指标。
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
