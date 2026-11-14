import { dayKey, dayKeyOffset, isDateKeyInWeek, isThisWeek, weekKeyOf } from './date'
import type { Todo, TodoKind } from './types'

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
    // 老数据没有 kind：一律算学习任务，不擅自把历史任务改判成「琐事」。
    // 代价是老的「未分类」任务会出现在「学习」筛选里，但它本来也不该被当成家务事
    kind: item.kind === 'chore' ? 'chore' : 'study',
    // 老版本的 id 就是 Date.now()，直接拿来当创建时间，不编一个新时间
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : id,
    // 老数据里已经完成的任务，不知道是哪天完成的 —— 留空，不算进「本周完成」，
    // 宁可少算也不伪造时间
    doneAt: typeof item.doneAt === 'number' ? item.doneAt : undefined,
    // 加日期之前建的任务没有截止日期：就让它没有，不去拿创建时间冒充，
    // 否则一堆早就做完的旧任务会突然全部变成「逾期」
    dueDate: isDateKey(item.dueDate) ? item.dueDate : undefined,
    // 目标页的里程碑任务；老数据没有这一项，就是普通任务
    achievementId:
      typeof item.achievementId === 'number' && Number.isFinite(item.achievementId)
        ? item.achievementId
        : undefined,
    // 软关联的里程碑（「服务于」）：算进里程碑进度，但任务本身照旧留在各处
    goalId: typeof item.goalId === 'number' && Number.isFinite(item.goalId) ? item.goalId : undefined,
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

/** 某个科目的任务（未分类传 UNCATEGORIZED_ID 即可；琐事不属于任何科目，不混进未分类页） */
export function forSubject(todos: Todo[], subjectId: string): Todo[] {
  return todos.filter(
    todo =>
      todo.subjectId === subjectId &&
      (subjectId !== UNCATEGORIZED_ID || todo.kind !== 'chore'),
  )
}

/**
 * 去掉挂在里程碑下的任务。
 *
 * 里程碑任务是「目标页的东西」，不该在计划·任务里当未分类再列一遍，
 * 也不该混进首页今日任务、复盘的本周完成率和活跃天数。
 * App 里算一份 mainTodos 传给这三个页面，四处口径就是同一个。
 */
export function withoutAchievement(list: Todo[]): Todo[] {
  return list.filter(todo => todo.achievementId === undefined)
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
 * 加一条。subjectId 由调用方决定（科目页带当前科目，首页带选中的科目，
 * 琐事传空字符串）；dueDate 是必填的截止日期（2026-11-03）。缺任何一项都不加。
 *
 * `goalId` 是「服务于」哪个里程碑，可以不传 —— 不传就是日常事务，
 * 不写这个键（跟 dueDate 空串的处理一个规矩）。它是软关联：任务照旧
 * 出现在首页和计划里，只是顺便算进里程碑的进度。
 */
export function addTodo(
  list: Todo[],
  text: string,
  subjectId: string,
  dueDate: string,
  kind: TodoKind = 'study',
  goalId?: number,
  now: number = Date.now(),
): Todo[] {
  const value = text.trim()
  if (!value || !dueDate) return list

  const todo: Todo = {
    id: nextId(list, now),
    text: value,
    done: false,
    // 琐事不归属任何科目，就算调用方传了也按空处理，别留一个半吊子状态
    subjectId: kind === 'chore' ? UNCATEGORIZED_ID : subjectId,
    kind,
    createdAt: now,
    dueDate,
  }
  if (goalId !== undefined) todo.goalId = goalId
  return [...list, todo]
}

/**
 * 给里程碑加一条任务。科目恒为空（里程碑任务不进科目页、也不算未分类），
 * kind 恒为 study，只多挂一个 achievementId。
 *
 * 截止日期可以不填：传空串（或者不传）就不写 dueDate 这个键。
 * 里程碑任务本来也不进到期提醒（App 传给别的页面的是 withoutAchievement 那份），
 * 所以没日期不会漏提醒什么事，有日期也只是列表里多一行日子。
 */
export function addAchievementTodo(
  list: Todo[],
  text: string,
  achievementId: number,
  dueDate = '',
  now: number = Date.now(),
): Todo[] {
  const value = text.trim()
  if (!value) return list

  const todo: Todo = {
    id: nextId(list, now),
    text: value,
    done: false,
    subjectId: UNCATEGORIZED_ID,
    kind: 'study',
    createdAt: now,
    achievementId,
  }
  // 没日期就不落这个键，跟 updateTodo 清日期时的规矩一致
  if (dueDate) todo.dueDate = dueDate
  return [...list, todo]
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

/** 改一条任务时能碰的字段。没传的字段保持原样 */
export type TodoPatch = {
  text?: string
  subjectId?: string
  kind?: TodoKind
  dueDate?: string
  /** 「服务于」哪个里程碑。传 null = 改回日常事务（把这个键删掉）；不传则不动 */
  goalId?: number | null
}

/**
 * 编辑一条任务：文字、类型、科目、截止日期。
 *
 * 三条硬规矩：
 * - 琐事的科目恒为空，切回学习再由调用方给科目，别留半吊子状态；
 * - 里程碑任务的科目也恒为空（它们只活在目标页，不进科目页、不算未分类），
 *   所以在目标页改文字不会把它变成某个科目的任务；
 * - `createdAt` / `doneAt` / `achievementId` / `done` 一概不动 ——
 *   改个错字不该让已完成的任务变回未完成，也不该改掉它「哪天完成的」。
 *
 * 文字清空（或者传 `''`）时原样返回，不会造出一个没内容的任务。
 */
export function updateTodo(list: Todo[], id: number, patch: TodoPatch): Todo[] {
  return list.map(todo => {
    if (todo.id !== id) return todo

    const text = patch.text === undefined ? todo.text : patch.text.trim()
    if (!text) return todo

    const kind = patch.kind ?? todo.kind
    const subjectId =
      kind === 'chore' || todo.achievementId !== undefined
        ? UNCATEGORIZED_ID
        : (patch.subjectId ?? todo.subjectId)
    // 日期空串按「没设日期」存，别落一个空字符串进 localStorage
    const dueDate =
      patch.dueDate === undefined ? todo.dueDate : patch.dueDate === '' ? undefined : patch.dueDate

    const next: Todo = { ...todo, text, kind, subjectId }
    // 没日期就把键删掉，不留一个 undefined 在对象里（跟撤销完成时清 doneAt 一个规矩）
    if (dueDate === undefined) delete next.dueDate
    else next.dueDate = dueDate
    // 「服务于」：null 是明确要求改回日常事务，跟「没传、别动」是两件事
    if (patch.goalId !== undefined) {
      if (patch.goalId === null) delete next.goalId
      else next.goalId = patch.goalId
    }
    return next
  })
}

/**
 * 计划页的筛选：全部 / 某个科目 / 琐事 / 未分类。
 *
 * 'chore' 和 'none' 是保留值，不会和科目 id 撞 —— 科目 id 是
 * english / math / clang 这种固定字符串（见 lib/seed.ts）。
 * 'none' 是「没科目的学习任务」，老数据都在这儿。
 */
export type TaskFilter = 'all' | 'chore' | 'none' | (string & {})

export function byFilter(list: Todo[], filter: TaskFilter): Todo[] {
  if (filter === 'all') return list
  if (filter === 'chore') return list.filter(todo => todo.kind === 'chore')
  if (filter === 'none') return list.filter(todo => todo.kind !== 'chore' && !todo.subjectId)
  return list.filter(todo => todo.kind !== 'chore' && todo.subjectId === filter)
}

/**
 * 「这周要处理的」范围，四类都收：
 * 1. 本周完成的 —— 勾完不能立刻从列表里消失，否则像被误删；
 * 2. 截止日期在本周的，不管做没做；
 * 3. 过期还没做的 —— 欠着的账不能藏起来，逾期本来就要看见；
 * 4. 没设日期的老任务：只收还没做的，免得几年前做完的一堆把列表堆满。
 *
 * 计划页现在改成**全部任务**、不再走这里了；函数留着，因为口径本身还要用
 * （复盘页算周统计、以后要做「本周视图」都会回到这套判定），删掉就得再写一遍。
 */
export function weekTasks(list: Todo[], now: number = Date.now()): Todo[] {
  return list.filter(todo => {
    if (isThisWeek(todo.doneAt, now)) return true
    if (!todo.dueDate) return !todo.done
    if (isDateKeyInWeek(todo.dueDate, now)) return true
    return !todo.done && todo.dueDate < weekKeyOf(now)
  })
}

/**
 * 计划页排序：按截止日期从近到远，没日期的排最后，已完成的一律沉底。
 * 不改原数组。同一天的按创建时间，早的在前，顺序稳定不会来回跳。
 * 日期都是 10 个字符的日期键，直接字符串比大小。
 */
export function sortForPlan(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1

    const aHas = Boolean(a.dueDate)
    const bHas = Boolean(b.dueDate)
    if (aHas !== bHas) return aHas ? -1 : 1
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate < b.dueDate ? -1 : 1
    }
    return a.createdAt - b.createdAt
  })
}

/**
 * 明天到期的任务，按截止排序。首页「明天」区块用它。
 *
 * **只给没做完的**：明天的事今天提前做完了，就没必要再占着「明天」这块，
 * 列出来会让「明天还剩几件」这件事看不准。
 *
 * 这批任务的 dueDate 全都一样，所以 sortForPlan 实际落到按创建时间，
 * 顺序稳定，不会每刷新一次就换个排法。
 */
export function tomorrowTasks(list: Todo[], now: number = Date.now()): Todo[] {
  const target = dayKeyOffset(dayKey(now), 1)
  return sortForPlan(list.filter(todo => todo.dueDate === target && !todo.done))
}
