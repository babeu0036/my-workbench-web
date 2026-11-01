import { isThisWeek } from './date'
import type { Todo } from './types'

/** 未分类科目的 id。老数据没有 subjectId，全归到这里，不丢 */
export const UNCATEGORIZED_ID = ''
export const UNCATEGORIZED_NAME = '未分类'

/** 一条老数据长什么样都可能，逐个字段兜底 */
export function normalizeTodo(raw: unknown, index = 0): Todo | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Todo>
  const text = typeof item.text === 'string' ? item.text : ''
  if (!text.trim()) return null

  const id =
    typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : Date.now() + index

  return {
    id,
    text,
    done: Boolean(item.done),
    subjectId: typeof item.subjectId === 'string' ? item.subjectId : UNCATEGORIZED_ID,
    // 老版本的 id 就是 Date.now()，直接拿来当创建时间，不编一个新时间
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : id,
    // 老数据里已经完成的任务，不知道是哪天完成的 —— 留空，不算进「本周完成」，
    // 宁可少算也不伪造时间
    doneAt: typeof item.doneAt === 'number' ? item.doneAt : undefined,
    // 加日期之前建的任务没有截止日期：就让它没有，不去拿创建时间冒充，
    // 否则一堆早就做完的旧任务会突然全部变成「逾期」
    dueDate: isDateKey(item.dueDate) ? item.dueDate : undefined,
  }
}

/** 只认 2026-11-03 这种本地日期键，别的一律当没设 */
function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** 把一个数组整体补成新形状；坏条目（没有文本的）会被丢掉 */
export function normalizeTodos(list: unknown): Todo[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item, index) => normalizeTodo(item, index))
    .filter((item): item is Todo => item !== null)
}

/** 某个科目的任务（未分类传 UNCATEGORIZED_ID 即可） */
export function forSubject(todos: Todo[], subjectId: string): Todo[] {
  return todos.filter(todo => todo.subjectId === subjectId)
}

/**
 * 一组任务的本周统计：x = 本周完成的条数，y = 本周新建 ∪ 本周完成 去重后的条数。
 * 上周建、这周做完的，x 和 y 都会算上它，所以 x 不会超过 y。
 *
 * 科目页传单科目的任务，复盘页传全部任务 —— 两边口径必须是同一份，
 * 所以这里只认「一组任务」，不再重复实现。
 */
export type WeekTotals = {
  done: number
  total: number
  /** 完成率，0-100 的整数。total 为 0 时给 0，不让 0/0 显示成 100% */
  percent: number
}

export function weekTotals(list: Todo[], now: number = Date.now()): WeekTotals {
  const finished = list.filter(todo => isThisWeek(todo.doneAt, now))
  const created = list.filter(todo => isThisWeek(todo.createdAt, now))
  const total = new Set([...created, ...finished].map(todo => todo.id)).size
  // 百分比和 x/y 在同一处算，界面上不会出现「0/0 却 100%」这种对不上的数
  const percent = total === 0 ? 0 : Math.round((finished.length / total) * 100)
  return { done: finished.length, total, percent }
}

/** 某个科目的本周统计 */
export function weekStats(
  todos: Todo[],
  subjectId: string,
  now: number = Date.now(),
): WeekTotals {
  return weekTotals(forSubject(todos, subjectId), now)
}

/** 新任务的 id：同一毫秒里连点两次也不会撞 */
export function nextId(list: Todo[], now: number = Date.now()): number {
  const max = list.reduce((acc, todo) => (todo.id > acc ? todo.id : acc), 0)
  return now > max ? now : max + 1
}

/**
 * 加一条。subjectId 由调用方决定（科目页带当前科目，首页带选中的科目）；
 * dueDate 是必填的截止日期（2026-11-03）。缺任何一项都不加，返回原数组。
 */
export function addTodo(
  list: Todo[],
  text: string,
  subjectId: string,
  dueDate: string,
  now: number = Date.now(),
): Todo[] {
  const value = text.trim()
  if (!value || !dueDate) return list
  return [
    ...list,
    { id: nextId(list, now), text: value, done: false, subjectId, createdAt: now, dueDate },
  ]
}

/** 勾选 / 撤销。完成时写 doneAt，撤销时清掉，绝不留旧时间 */
export function toggleTodo(list: Todo[], id: number, now: number = Date.now()): Todo[] {
  return list.map(todo => {
    if (todo.id !== id) return todo
    if (!todo.done) return { ...todo, done: true, doneAt: now }
    const rest: Todo = { ...todo, done: false }
    delete rest.doneAt
    return rest
  })
}

export function removeTodo(list: Todo[], id: number): Todo[] {
  return list.filter(todo => todo.id !== id)
}

export function clearDone(list: Todo[]): Todo[] {
  return list.filter(todo => !todo.done)
}
