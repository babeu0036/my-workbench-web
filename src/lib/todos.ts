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
  }
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
 * 本周统计：x = 本周完成的条数，y = 本周新建 ∪ 本周完成 去重后的条数。
 * 上周建、这周做完的，x 和 y 都会算上它，所以 x 不会超过 y。
 */
export function weekStats(
  todos: Todo[],
  subjectId: string,
  now: number = Date.now(),
): { done: number; total: number } {
  const mine = forSubject(todos, subjectId)
  const finished = mine.filter(todo => isThisWeek(todo.doneAt, now))
  const created = mine.filter(todo => isThisWeek(todo.createdAt, now))
  const total = new Set([...created, ...finished].map(todo => todo.id)).size
  return { done: finished.length, total }
}

/** 新任务的 id：同一毫秒里连点两次也不会撞 */
export function nextId(list: Todo[], now: number = Date.now()): number {
  const max = list.reduce((acc, todo) => (todo.id > acc ? todo.id : acc), 0)
  return now > max ? now : max + 1
}

/** 加一条。subjectId 由调用方决定（科目页带当前科目，首页带未分类） */
export function addTodo(
  list: Todo[],
  text: string,
  subjectId: string,
  now: number = Date.now(),
): Todo[] {
  const value = text.trim()
  if (!value) return list
  return [...list, { id: nextId(list, now), text: value, done: false, subjectId, createdAt: now }]
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
