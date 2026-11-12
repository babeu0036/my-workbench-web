import { UNSORTED_STAGE_ID } from './stages'
import type { Goal, Stage } from './types'

/**
 * 目标条目。挂在阶段（Stage）下，一个阶段想加几条加几条。
 *
 * 阶段本身在 lib/stages.ts —— 这里只管「目标这一条」的增删改和排序。
 * 以前叫「周期」，字段从 periodId 改成了 stageId，老数据在读盘时搬过来。
 *
 * 跟更早版本的区别：以前一周只留一条、保存时把上周结掉、点了就锁定；
 * 现在勾了能取消，阶段过了就是「已结束」，不用结算。
 */

/* ---------- 读盘 ---------- */

export function normalizeGoal(raw: unknown, index = 0, now: number = Date.now()): Goal | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Goal> & { periodId?: unknown }
  const text = typeof item.text === 'string' ? item.text.trim() : ''
  if (!text) return null

  // 老数据是 periodId；两者都没有就归「未分组」，不因为一个字段没搬完丢掉整条
  const rawStage = typeof item.stageId === 'number' ? item.stageId : item.periodId
  const stageId =
    typeof rawStage === 'number' && Number.isFinite(rawStage) ? rawStage : UNSORTED_STAGE_ID

  const id = typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : now + index

  const done = Boolean(item.done)
  const goal: Goal = { id, stageId, text, done }
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

/* ---------- 写 ---------- */

/** 新 id：同一毫秒里连点两次也不会撞 */
function nextId(list: { id: number }[], now: number): number {
  const max = list.reduce((acc, item) => (item.id > acc ? item.id : acc), 0)
  return now > max ? now : max + 1
}

export function addGoal(
  list: Goal[],
  input: { stageId: number; text: string },
  now: number = Date.now(),
): Goal[] {
  const text = input.text.trim()
  if (!text) return list
  return [...list, { id: nextId(list, now), stageId: input.stageId, text, done: false }]
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

/* ---------- 分组与展示 ---------- */

/** 某个阶段下的所有目标，按添加顺序 */
export function goalsOfStage(goals: Goal[], stageId: number): Goal[] {
  return goals.filter(goal => goal.stageId === stageId)
}

/** 阶段里完成了几条目标 */
export function stageGoalStats(goals: Goal[], stageId: number) {
  const list = goalsOfStage(goals, stageId)
  const done = list.filter(goal => goal.done).length
  const total = list.length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/**
 * 扁平一列的顺序：没做完的在前，做完的沉底；
 * 两组内部都按「阶段排在前面」的次序走，同一个阶段里按添加顺序。
 * 未分组的（stageId = 0）永远排在所有阶段之后。
 */
export function sortForGoalList(goals: Goal[], stages: Stage[]): Goal[] {
  const order = new Map<number, number>()
  ;[...stages]
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .forEach((stage, index) => order.set(stage.id, index))

  return [...goals].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const oa = order.get(a.stageId) ?? Number.MAX_SAFE_INTEGER
    const ob = order.get(b.stageId) ?? Number.MAX_SAFE_INTEGER
    return oa === ob ? a.id - b.id : oa - ob
  })
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
  return (
    Boolean(raw) &&
    typeof raw === 'object' &&
    typeof (raw as { weekKey?: unknown }).weekKey === 'string'
  )
}

/** 旧周目标变成一个阶段，标题是「10.26 那周」（月日保留两位，跟别处的写法一致） */
export function legacyPeriodTitle(weekKey: string): string {
  const [, m, d] = weekKey.split('-')
  return `${m}.${d} 那周`
}
