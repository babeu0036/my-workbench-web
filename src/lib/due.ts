import { daysUntil } from './date'
import type { Todo } from './types'

/**
 * 到期前几天开始提醒。改这一个数字，列表颜色、首页提醒卡、角标全都跟着变。
 */
export const REMIND_DAYS = 3

/** 距离截止还有几天；没设日期就是 NaN */
export function dueDays(todo: Todo, now: number = Date.now()): number {
  return todo.dueDate ? daysUntil(todo.dueDate, now) : Number.NaN
}

/** 剩余天数 → 给人看的一句话 */
export function dueLabel(days: number): string {
  if (!Number.isFinite(days)) return ''
  if (days < 0) return `逾期 ${-days} 天`
  if (days === 0) return '今天到期'
  if (days === 1) return '明天到期'
  return `还有 ${days} 天`
}

/** 颜色档位：逾期 / 今天 / 三天内 / 更远 */
export function dueTone(days: number): 'late' | 'today' | 'soon' | 'later' {
  if (!Number.isFinite(days)) return 'later'
  if (days < 0) return 'late'
  if (days === 0) return 'today'
  if (days <= REMIND_DAYS) return 'soon'
  return 'later'
}

/**
 * 这条任务现在该不该提醒。
 *
 * 提醒窗口是「到期前 3 天」一直到「做完为止」，不是「每天发一条新消息」——
 * 只要没完成、又进了窗口，每天打开工作台它都在。这样不用记「今天提醒过没有」，
 * 也不会因为某天没打开就漏掉。
 */
export function needsReminder(todo: Todo, now: number = Date.now()): boolean {
  if (todo.done || !todo.dueDate) return false
  const days = dueDays(todo, now)
  return Number.isFinite(days) && days <= REMIND_DAYS
}

/** 该提醒的任务，最急的排最前：逾期 → 今天 → 明天 → 后天 */
export function pendingReminders(list: Todo[], now: number = Date.now()): Todo[] {
  return list
    .filter(todo => needsReminder(todo, now))
    .sort((a, b) => dueDays(a, now) - dueDays(b, now) || a.createdAt - b.createdAt)
}

/** 有没有「已经到期或逾期」的，用来决定提醒卡要不要变红 */
export function hasUrgent(list: Todo[], now: number = Date.now()): boolean {
  return list.some(todo => {
    const days = dueDays(todo, now)
    return Number.isFinite(days) && days <= 0
  })
}
