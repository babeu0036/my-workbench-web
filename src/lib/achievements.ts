import type { Achievement, Todo } from './types'

/**
 * 成就。目标页上的大块，一条成就下面挂若干任务（`Todo.achievementId`）。
 *
 * 这里只放纯函数：读盘兜底、增删、按成就分组、算进度、自动点亮。
 * 「已点亮」没有手动按钮 —— 任务数 ≥ 1 且全部完成就写 doneAt，
 * 有任务被取消勾选就把 doneAt 删掉，页面上看到的三种状态全是算出来的。
 */

/** 一条成就长什么样都可能，逐个字段兜底；没有标题的直接丢掉（认不出是什么） */
export function normalizeAchievement(raw: unknown, index = 0): Achievement | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Achievement>

  const title = typeof item.title === 'string' ? item.title.trim() : ''
  if (!title) return null

  const id =
    typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : Date.now() + index
  const note = typeof item.note === 'string' ? item.note.trim() : ''
  const doneAt =
    typeof item.doneAt === 'number' && Number.isFinite(item.doneAt) ? item.doneAt : undefined

  return {
    id,
    title,
    // 空备注不留下 `note: ''` 这种半截键，判断处只看有没有这个字段
    ...(note ? { note } : {}),
    ...(doneAt !== undefined ? { doneAt } : {}),
  }
}

export function normalizeAchievements(list: unknown): Achievement[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item, index) => normalizeAchievement(item, index))
    .filter((item): item is Achievement => item !== null)
}

/** 新成就的 id：同一毫秒里连点两次也不会撞 */
export function nextAchievementId(list: Achievement[], now: number = Date.now()): number {
  const max = list.reduce((acc, item) => (item.id > acc ? item.id : acc), 0)
  return now > max ? now : max + 1
}

/** 加一条成就。标题是唯一必填项，备注可以空 */
export function addAchievement(
  list: Achievement[],
  title: string,
  note = '',
  now: number = Date.now(),
): Achievement[] {
  const value = title.trim()
  if (!value) return list
  const remark = note.trim()
  return [
    ...list,
    { id: nextAchievementId(list, now), title: value, ...(remark ? { note: remark } : {}) },
  ]
}

export function removeAchievement(list: Achievement[], id: number): Achievement[] {
  return list.filter(item => item.id !== id)
}

/**
 * 删成就时任务不跟着删：只把 achievementId 摘掉，它们退回「未分类」
 * （subjectId 本来就是空的，摘掉标记就会出现在计划·任务里）。
 */
export function detachTasks(todos: Todo[], id: number): Todo[] {
  let changed = false
  const next = todos.map(todo => {
    if (todo.achievementId !== id) return todo
    changed = true
    const rest = { ...todo }
    delete rest.achievementId
    return rest
  })
  return changed ? next : todos
}

/** 某个成就下的任务，按创建时间从早到晚 —— 列表顺序跟添加顺序一致 */
export function forAchievement(todos: Todo[], id: number): Todo[] {
  return todos
    .filter(todo => todo.achievementId === id)
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
}

export type AchievementStats = {
  done: number
  total: number
  /** 0-100 的整数。total 为 0 时给 0，不显示成 100% */
  percent: number
}

/** 一组任务的完成情况 —— 卡片手里只有已经筛好的任务，所以单独留一个入口 */
export function statsOf(tasks: Todo[]): AchievementStats {
  const done = tasks.filter(todo => todo.done).length
  const total = tasks.length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export type AchievementState = 'empty' | 'running' | 'lit'

/**
 * 卡片的三态。已点亮以 doneAt 为准，但「全都勾上了、doneAt 还没写进去」
 * 的那一帧也算点亮，免得卡片先闪一下「进行中」。
 */
export function achievementState(item: Achievement, tasks: Todo[]): AchievementState {
  if (tasks.length === 0) return 'empty'
  if (item.doneAt !== undefined) return 'lit'
  return tasks.every(todo => todo.done) ? 'lit' : 'running'
}

/**
 * 自动点亮 / 熄灭。返回的还是同一个数组引用时表示什么都没变 ——
 * App 里那个 effect 靠这个判断要不要写盘，不然 setState 会自己触发自己。
 */
export function withLitState(
  list: Achievement[],
  todos: Todo[],
  now: number = Date.now(),
): Achievement[] {
  let changed = false

  const next = list.map(item => {
    const tasks = forAchievement(todos, item.id)
    const lit = tasks.length > 0 && tasks.every(todo => todo.done)

    if (lit && item.doneAt === undefined) {
      changed = true
      return { ...item, doneAt: now }
    }
    if (!lit && item.doneAt !== undefined) {
      changed = true
      const rest = { ...item }
      delete rest.doneAt
      return rest
    }
    return item
  })

  return changed ? next : list
}
