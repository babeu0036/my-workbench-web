import type { Goal } from './types'

/**
 * 周目标。一周一条，weekKey 是当周周一的日期（2026-10-26），
 * 固定 10 个字符，所以字符串比较就是时间先后。
 *
 * 这条数据被两处读：复盘页（结算 + 写新目标）、首页（显示当前周的目标）。
 * 页面只管渲染，全部判断都在这里，以后加「目标历史」也是从这里取。
 */

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/

/** 一条目标长什么样都可能，逐个字段兜底；文本为空或周次不合法的直接丢掉 */
export function normalizeGoal(raw: unknown, index = 0): Goal | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Goal>
  const text = typeof item.text === 'string' ? item.text.trim() : ''
  const weekKey = typeof item.weekKey === 'string' ? item.weekKey : ''
  if (!text || !KEY_RE.test(weekKey)) return null

  const id =
    typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : Date.now() + index

  return {
    id,
    weekKey,
    text,
    done: Boolean(item.done),
    settled: Boolean(item.settled),
  }
}

export function normalizeGoals(list: unknown): Goal[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item, index) => normalizeGoal(item, index))
    .filter((item): item is Goal => item !== null)
}

/** 新目标的 id：同一毫秒里连点两次也不会撞 */
export function nextGoalId(list: Goal[], now: number = Date.now()): number {
  const max = list.reduce((acc, goal) => (goal.id > acc ? goal.id : acc), 0)
  return now > max ? now : max + 1
}

/** 某一周的目标。同周有多条时取最后写入的那条 */
export function goalOf(list: Goal[], weekKey: string): Goal | undefined {
  return list
    .filter(goal => goal.weekKey === weekKey)
    .reduce<Goal | undefined>((acc, goal) => (!acc || goal.id > acc.id ? goal : acc), undefined)
}

/**
 * 复盘页要展示的「上一条目标」：所有早于本周的目标里，周次最大的那条。
 * 上周没设过就往前顺延，卡片上会写它真实的周区间，不假装它是上周。
 */
export function lastTarget(list: Goal[], thisWeekKey: string): Goal | undefined {
  let best: Goal | undefined
  for (const goal of list) {
    if (goal.weekKey >= thisWeekKey) continue
    if (!best || goal.weekKey > best.weekKey || (goal.weekKey === best.weekKey && goal.id > best.id)) {
      best = goal
    }
  }
  return best
}

/**
 * 结算某一条。done 由按钮决定，settled 一置 true 就不再改回去 ——
 * 这是这一周的历史记录，改判会让复盘的结论失去意义。
 */
export function settleGoal(list: Goal[], id: number, done: boolean): Goal[] {
  return list.map(goal => (goal.id === id ? { ...goal, done, settled: true } : goal))
}

type SaveInput = {
  text: string
  /** 写进哪一周（复盘页写的是下周） */
  weekKey: string
  /** 早于这一周、还没结算的目标，一起结掉 */
  settleBefore: string
  now?: number
}

/**
 * 写一条周目标：
 * 1. 先把更早、还没结算的目标结掉 —— 没点过按钮的算「没完成」，不伪造 done；
 * 2. 目标那一周已经有目标就覆盖文字并重置为未结算，没有才追加。
 * 一周只留一条，首页读「当前 weekKey 的目标」才不会读出歧义。
 */
export function saveGoal(list: Goal[], input: SaveInput): Goal[] {
  const value = input.text.trim()
  if (!value) return list

  const settled = list.map(goal =>
    !goal.settled && goal.weekKey < input.settleBefore ? { ...goal, settled: true } : goal,
  )

  const existing = goalOf(settled, input.weekKey)
  if (existing) {
    return settled.map(goal =>
      goal.id === existing.id ? { ...goal, text: value, done: false, settled: false } : goal,
    )
  }

  return [
    ...settled,
    {
      id: nextGoalId(settled, input.now),
      weekKey: input.weekKey,
      text: value,
      done: false,
      settled: false,
    },
  ]
}
