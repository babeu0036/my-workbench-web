import { daysUntil } from './date'
import type { Deadline } from './types'

/** 报名截止前几天开始标红 */
export const SIGNUP_SOON_DAYS = 3

/** 三个时间点：报名截止 / 比赛开始 / 比赛结束 */
export type Milestone = 'signup' | 'start' | 'end'

export type Step = {
  kind: Milestone
  /** 形如 2026-11-05 */
  date: string
  /** 距今天几天，0 就是当天 */
  days: number
}

/** 表单交上来的原始值，允许比赛日期是空串 */
export type DeadlineInput = {
  name: string
  signupEnd: string
  startDate?: string
  endDate?: string
  /** 「服务于」哪条里程碑；undefined = 日常事务，不写这个键 */
  goalId?: number
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * 老数据只有一个 date，它的语义就是「截止日期」，整条搬给报名截止；
 * 比赛开始 / 结束没有就是没有，不拿报名截止去冒充。
 * 名称和报名截止缺一个就认不出这是场比赛，只能丢掉。
 */
export function normalizeDeadline(raw: unknown, index = 0): Deadline | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Deadline> & { date?: unknown }
  const name = typeof item.name === 'string' ? item.name.trim() : ''

  const signupEnd = isDateKey(item.signupEnd)
    ? item.signupEnd
    : isDateKey(item.date)
      ? item.date
      : ''
  if (!name || !signupEnd) return null

  const id =
    typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : Date.now() + index

  // 老数据没有 goalId，缺这个键就是日常事务，不该报错
  const goalId =
    typeof item.goalId === 'number' && Number.isFinite(item.goalId) ? item.goalId : undefined

  return {
    id,
    name,
    signupEnd,
    startDate: isDateKey(item.startDate) ? item.startDate : undefined,
    endDate: isDateKey(item.endDate) ? item.endDate : undefined,
    ...(goalId !== undefined ? { goalId } : {}),
  }
}

export function normalizeDeadlines(list: unknown): Deadline[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item, index) => normalizeDeadline(item, index))
    .filter((item): item is Deadline => item !== null)
}

/** 报名截止还剩几天；已过是负数 */
export function signupDays(item: Deadline, now: number = Date.now()): number {
  return daysUntil(item.signupEnd, now)
}

/**
 * 整条算不算「已截止」：只看报名截止，跟比赛日期无关。
 * 报名截止一过，这件事就没法再报了，再高亮只会误导。
 */
export function isClosed(item: Deadline, now: number = Date.now()): boolean {
  const days = signupDays(item, now)
  return Number.isFinite(days) && days < 0
}

/** 报名截止前 3 天内（含今天），要标红 */
export function isSignupSoon(item: Deadline, now: number = Date.now()): boolean {
  const days = signupDays(item, now)
  return Number.isFinite(days) && days >= 0 && days <= SIGNUP_SOON_DAYS
}

/**
 * 三个时间点里最近一个还没过期的，用来算「剩余天数」。
 * 报名截止过了但比赛还没开始，就会顺延到比赛开始那一天。
 * 全过了（或者没填比赛日期且报名截止已过）返回 null。
 */
export function nextStep(item: Deadline, now: number = Date.now()): Step | null {
  const steps: Step[] = [
    { kind: 'signup', date: item.signupEnd, days: daysUntil(item.signupEnd, now) },
  ]
  if (item.startDate) {
    steps.push({ kind: 'start', date: item.startDate, days: daysUntil(item.startDate, now) })
  }
  if (item.endDate) {
    steps.push({ kind: 'end', date: item.endDate, days: daysUntil(item.endDate, now) })
  }

  const alive = steps.filter(step => Number.isFinite(step.days) && step.days >= 0)
  if (alive.length === 0) return null
  // 同一天的话保留定义顺序：报名截止优先于开赛
  return alive.sort((a, b) => a.days - b.days)[0]
}

const STEP_NAME: Record<Milestone, string> = {
  signup: '截止',
  start: '开赛',
  end: '结束',
}

/** 倒计时文案：今天截止 / 明天截止 / 还剩 3 天 / 距开赛 5 天 */
export function stepLabel(step: Step): string {
  const name = STEP_NAME[step.kind]
  if (step.days === 0) return `今天${name}`
  if (step.days === 1) return `明天${name}`
  if (step.kind === 'signup') return `还剩 ${step.days} 天`
  return `距${name} ${step.days} 天`
}

/** 2026-11-05 → 11月5日。列表一行放不下星期几 */
function monthDay(key: string): string {
  const [, m, d] = key.split('-')
  return `${Number(m)}月${Number(d)}日`
}

/** 比赛日期那一行：11月5日 - 11月6日 / 11月5日 开赛 / 11月6日 结束 */
export function contestLabel(item: Deadline): string {
  const start = item.startDate ? monthDay(item.startDate) : ''
  const end = item.endDate ? monthDay(item.endDate) : ''

  if (start && end) return start === end ? start : `${start} - ${end}`
  if (start) return `${start} 开赛`
  if (end) return `${end} 结束`
  return ''
}

/** 表单校验：返回第一句要给人看的话，没问题就是 null */
export function validateDeadline(input: DeadlineInput): string | null {
  if (!input.name.trim()) return '先写比赛名称'
  if (!input.signupEnd) return '再选报名截止日期'
  // 日期键是定长字符串，直接比大小就是比先后
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    return '比赛结束不能早于开始'
  }
  return null
}

/** 新条目的 id：同一毫秒里连点两次也不会撞 */
function nextId(list: Deadline[], now: number): number {
  const max = list.reduce((acc, item) => (item.id > acc ? item.id : acc), 0)
  return now > max ? now : max + 1
}

export function addDeadline(
  list: Deadline[],
  input: DeadlineInput,
  now: number = Date.now(),
): Deadline[] {
  if (validateDeadline(input)) return list
  return [
    ...list,
    {
      id: nextId(list, now),
      name: input.name.trim(),
      signupEnd: input.signupEnd,
      startDate: input.startDate || undefined,
      endDate: input.endDate || undefined,
      // 不选里程碑就不写这个键，跟任务那边的 goalId 一个规矩
      ...(input.goalId !== undefined ? { goalId: input.goalId } : {}),
    },
  ]
}

export function removeDeadline(list: Deadline[], id: number): Deadline[] {
  return list.filter(item => item.id !== id)
}

/**
 * 排序：未截止的在前面，按最近时间点从近到远；
 * 已截止的沉底，里面最近刚截止的靠上（那是你最后还能想起的一场）。
 */
export function sortDeadlines(list: Deadline[], now: number = Date.now()): Deadline[] {
  return [...list].sort((a, b) => {
    const closedA = isClosed(a, now)
    const closedB = isClosed(b, now)
    if (closedA !== closedB) return closedA ? 1 : -1
    if (closedA) return signupDays(b, now) - signupDays(a, now)

    const stepA = nextStep(a, now)
    const stepB = nextStep(b, now)
    const daysA = stepA ? stepA.days : Number.POSITIVE_INFINITY
    const daysB = stepB ? stepB.days : Number.POSITIVE_INFINITY
    return daysA - daysB
  })
}
