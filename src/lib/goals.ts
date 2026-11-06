import { dayKey, dayKeyOffset, formatDateRange, weekKeyOf } from './date'
import type { Goal, GoalPeriod } from './types'

/**
 * 目标 = 周期（本学期 / 暑假 / 这周 / 自己起的名）+ 周期下的一堆目标。
 *
 * 两处读它：目标页（扁平一列，每条前面挂周期标签）、首页（当前周期那几条）。
 * 页面只管渲染，判断全在这里。
 *
 * 跟旧版的区别：以前一周只留一条、保存时把上周结掉、点了就锁定；
 * 现在一个周期想加几条加几条，勾了能取消，周期过了就是「已结束」，不用结算。
 */

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_RE.test(value)
}

/** id 缺了或坏了就用 now + index 顶上，不让整条数据进不来 */
function idOf(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback
}

/* ---------- 周期 ---------- */

export function normalizePeriod(
  raw: unknown,
  index = 0,
  now: number = Date.now(),
): GoalPeriod | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<GoalPeriod>
  const title = typeof item.title === 'string' ? item.title.trim() : ''
  if (!title || !isDateKey(item.start) || !isDateKey(item.end)) return null
  // 起止写反了就换过来，不因为一个手误把整条丢掉
  const [start, end] = item.start <= item.end ? [item.start, item.end] : [item.end, item.start]
  return { id: idOf(item.id, now + index), title, start, end }
}

export function normalizePeriods(list: unknown, now: number = Date.now()): GoalPeriod[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item, index) => normalizePeriod(item, index, now))
    .filter((item): item is GoalPeriod => item !== null)
}

/* ---------- 目标 ---------- */

export function normalizeGoal(raw: unknown, index = 0, now: number = Date.now()): Goal | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Goal>
  const text = typeof item.text === 'string' ? item.text.trim() : ''
  if (!text) return null
  if (typeof item.periodId !== 'number' || !Number.isFinite(item.periodId)) return null

  const done = Boolean(item.done)
  const goal: Goal = { id: idOf(item.id, now + index), periodId: item.periodId, text, done }
  // 取消勾选会清掉时间，所以只有「已完成 + 有时间」才带上这个键，
  // 不落一个 doneAt: undefined 进去（跟 toggleGoal 删键的规矩一致）
  if (done && typeof item.doneAt === 'number') goal.doneAt = item.doneAt
  return goal
}

export function normalizeGoals(list: unknown, now: number = Date.now()): Goal[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item, index) => normalizeGoal(item, index, now))
    .filter((item): item is Goal => item !== null)
}

/** 新 id：同一毫秒里连点两次也不会撞 */
function nextId(list: { id: number }[], now: number): number {
  const max = list.reduce((acc, item) => (item.id > acc ? item.id : acc), 0)
  return now > max ? now : max + 1
}

/** 新建周期时先在面板里把 id 定下来，提交那边就不必等 state 更新 */
export function nextPeriodId(list: GoalPeriod[], now: number = Date.now()): number {
  return nextId(list, now)
}

/** 某个周期下的所有目标，按添加顺序 */
export function goalsOf(goals: Goal[], periodId: number): Goal[] {
  return goals.filter(goal => goal.periodId === periodId)
}

/** 周期里完成了几条 */
export function periodStats(goals: Goal[], periodId: number) {
  const list = goalsOf(goals, periodId)
  const done = list.filter(goal => goal.done).length
  const total = list.length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/** 这个周期包不包含这一天（起止都含当天） */
export function periodCovers(period: GoalPeriod, dateKey: string): boolean {
  return dateKey >= period.start && dateKey <= period.end
}

export type PeriodState = 'upcoming' | 'running' | 'past'

export function periodState(period: GoalPeriod, now: number = Date.now()): PeriodState {
  const today = dayKey(now)
  if (today < period.start) return 'upcoming'
  if (today > period.end) return 'past'
  return 'running'
}

/** 周期排序：开始的早的在前；同一天开始的，结束早的在前 */
export function sortPeriods(list: GoalPeriod[]): GoalPeriod[] {
  return [...list].sort((a, b) =>
    a.start === b.start ? a.end.localeCompare(b.end) : a.start.localeCompare(b.start),
  )
}

/** 今天落在哪个周期里。学期里套着暑假时，取结束得更近的那个（当下更该盯的） */
export function activePeriod(list: GoalPeriod[], now: number = Date.now()): GoalPeriod | undefined {
  const today = dayKey(now)
  return list
    .filter(period => periodCovers(period, today))
    .reduce<GoalPeriod | undefined>(
      (acc, period) => (!acc || period.end < acc.end ? period : acc),
      undefined,
    )
}

/**
 * 扁平一列的顺序：没做完的在前，做完的沉底；
 * 两组内部都按「周期开始得早的靠前」，同一个周期里按添加顺序 ——
 * 也就是本学期的大目标排在暑假前面，同周期内按你想的顺序往下滚。
 */
export function sortForGoalList(goals: Goal[], periods: GoalPeriod[]): Goal[] {
  const order = new Map<number, number>()
  sortPeriods(periods).forEach((period, index) => order.set(period.id, index))

  return [...goals].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const oa = order.get(a.periodId) ?? Number.MAX_SAFE_INTEGER
    const ob = order.get(b.periodId) ?? Number.MAX_SAFE_INTEGER
    return oa === ob ? a.id - b.id : oa - ob
  })
}

/* ---------- 写 ---------- */

export function addPeriod(
  list: GoalPeriod[],
  input: { title: string; start: string; end: string },
  now: number = Date.now(),
): GoalPeriod[] {
  const title = input.title.trim()
  if (!title || !isDateKey(input.start) || !isDateKey(input.end)) return list
  const [start, end] = input.start <= input.end ? [input.start, input.end] : [input.end, input.start]
  // 名字和起止都一样就当同一个周期，不重复建 —— 连点两下预设不会多出一个
  if (list.some(item => item.title === title && item.start === start && item.end === end)) return list
  return [...list, { id: nextId(list, now), title, start, end }]
}

/** 改周期：名字和起止都能改；起止写反了自动换过来 */
export function updatePeriod(
  list: GoalPeriod[],
  id: number,
  patch: { title?: string; start?: string; end?: string },
): GoalPeriod[] {
  return list.map(period => {
    if (period.id !== id) return period
    const title = patch.title === undefined ? period.title : patch.title.trim()
    if (!title) return period
    const rawStart = patch.start ?? period.start
    const rawEnd = patch.end ?? period.end
    if (!isDateKey(rawStart) || !isDateKey(rawEnd)) return period
    const [start, end] = rawStart <= rawEnd ? [rawStart, rawEnd] : [rawEnd, rawStart]
    return { ...period, title, start, end }
  })
}

/** 删周期：挂在它下面的目标一起删（目标脱离周期没有意义） */
export function removePeriod(
  periods: GoalPeriod[],
  goals: Goal[],
  id: number,
): { periods: GoalPeriod[]; goals: Goal[] } {
  return {
    periods: periods.filter(period => period.id !== id),
    goals: goals.filter(goal => goal.periodId !== id),
  }
}

export function addGoal(
  list: Goal[],
  input: { periodId: number; text: string },
  now: number = Date.now(),
): Goal[] {
  const text = input.text.trim()
  if (!text) return list
  return [...list, { id: nextId(list, now), periodId: input.periodId, text, done: false }]
}

export function updateGoal(list: Goal[], id: number, text: string): Goal[] {
  const value = text.trim()
  if (!value) return list
  // 只改文字：完成状态和完成时间都不动（改错字不该把已完成变回未完成）
  return list.map(goal => (goal.id === id ? { ...goal, text: value } : goal))
}

export function removeGoal(list: Goal[], id: number): Goal[] {
  return list.filter(goal => goal.id !== id)
}

/** 勾选 / 取消。完成写 doneAt，取消就把这个键删掉，不留旧时间 */
export function toggleGoal(list: Goal[], id: number, now: number = Date.now()): Goal[] {
  return list.map(goal => {
    if (goal.id !== id) return goal
    if (goal.done) {
      const { doneAt: _dropped, ...rest } = goal
      return { ...rest, done: false }
    }
    return { ...goal, done: true, doneAt: now }
  })
}

/* ---------- 预设周期 ---------- */

export type PeriodPreset = {
  /** 稳定标识，用来判断同一个预设是不是已经建过了 */
  key: string
  title: string
  start: string
  end: string
}

/**
 * 五个快捷周期。点了就填进去，建完还能改名改日期。
 *
 * 学期按课程表里设的「学期开始」往后推 20 周（跟课程表 MAX_WEEK 一个数）；
 * 没设过就没有这一项 —— 不替用户编一个学期出来。
 * 暑假 / 寒假没有校历可依，按常见区间给：暑假 7/1-8/31、寒假 1/15-2/20，
 * 今年的已经过完就顺延到明年。
 */
export function periodPresets(semesterStart: string, now: number = Date.now()): PeriodPreset[] {
  const today = dayKey(now)
  const d = new Date(now)
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')

  const weekKey = weekKeyOf(now)
  const monthStart = `${y}-${mm}-01`
  const monthEnd = dayKeyOffset(
    `${y}-${String(d.getMonth() + 2).padStart(2, '0')}-01`,
    -1,
  )

  const list: PeriodPreset[] = [
    { key: `week:${weekKey}`, title: '本周', start: weekKey, end: dayKeyOffset(weekKey, 6) },
    { key: `month:${y}-${mm}`, title: '本月', start: monthStart, end: monthEnd },
  ]

  if (isDateKey(semesterStart)) {
    list.push({
      key: `semester:${semesterStart}`,
      title: '本学期',
      start: semesterStart,
      end: dayKeyOffset(semesterStart, 20 * 7 - 1),
    })
  }

  const summerYear = today <= `${y}-08-31` ? y : y + 1
  list.push({
    key: `summer:${summerYear}`,
    title: '暑假',
    start: `${summerYear}-07-01`,
    end: `${summerYear}-08-31`,
  })

  const winterYear = today <= `${y}-02-20` ? y : y + 1
  list.push({
    key: `winter:${winterYear}`,
    title: '寒假',
    start: `${winterYear}-01-15`,
    end: `${winterYear}-02-20`,
  })

  return list
}

/** 周期上的日期写成 10.26 - 11.01（跨年时两头带年份），标签和卡片共用 */
export function periodRangeText(period: { start: string; end: string }): string {
  return formatDateRange(period.start, period.end)
}

/* ---------- 老数据 ---------- */

/** 旧版目标长这样：{ id, weekKey, text, done, settled }。迁移时按 weekKey 分组认它 */
export type LegacyGoal = {
  id?: number
  weekKey: string
  text: string
  done?: boolean
  settled?: boolean
}

export function isLegacyGoal(raw: unknown): raw is LegacyGoal {
  return Boolean(raw) && typeof raw === 'object' && typeof (raw as { weekKey?: unknown }).weekKey === 'string'
}

/** 旧周目标变成一个周期，标题是「10.26 那周」（月日保留两位，跟别处的写法一致） */
export function legacyPeriodTitle(weekKey: string): string {
  const [, m, d] = weekKey.split('-')
  return `${m}.${d} 那周`
}
