import { useEffect, useState } from 'react'
import { dayKeyOffset } from './date'
import { isLegacyGoal, legacyPeriodTitle } from './goals'
import type { LegacyGoal } from './goals'
import { normalizeTodos } from './todos'
import type { Goal, GoalPeriod, Todo } from './types'

/** localStorage 的几个 key，分开存，互不影响 */
export const KEYS = {
  todos: 'workbench.todos',
  deadlines: 'workbench.deadlines',
  notes: 'workbench.notes',
  /** 目标：{ id, periodId, text, done, doneAt? }，挂在下面对应的周期上 */
  goals: 'workbench.goals',
  /** 目标周期：本学期 / 暑假 / 那周，{ id, title, start, end } */
  goalPeriods: 'workbench.goalPeriods',
  /** 首页添加面板上次选的科目，只有一个字符串 */
  lastSubject: 'workbench.lastSubject',
  /** 课程表：课程数组 */
  courses: 'workbench.courses',
  /** 学期第 1 周的周一，形如 2026-09-01。没设就一直是 ''，单双周算不出来 */
  semesterStart: 'workbench.semesterStart',
  /** 今日状态，按日期键存一份：{ '2026-11-01': 'good' } */
  mood: 'workbench.mood',
  /** 成就（目标页），数组 */
  achievements: 'workbench.achievements',
  /** 目标页最上面那行「最终目标」（vision），只有一个字符串 */
  vision: 'workbench.vision',
} as const

/** 旧版的最终目标键，只在迁移时读一次，搬完保留不删 */
const LEGACY_VISION_KEY = 'workbench.finalGoal'

/** 读一个 key，读不出来（没有 / 坏了）就返回兜底值 */
export function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** 写一个 key，写满了也不让页面崩 */
export function writeKey<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    // 通知云同步：本地变了，稍后推一次
    window.dispatchEvent(new Event('workbench:change'))
  } catch {
    // 隐私模式 / 空间不足：忽略即可，页面照常可用
  }
}

/**
 * 跟 useState 一样用，但会自动跟 localStorage 同步：
 * 初始值从本地读，之后每次变化自动写回。
 *
 * 第三个参数是可选的老数据补齐函数：读盘时先跑一遍。
 * 挂载时下面那个 effect 本来就会写一次盘，所以补完的新形状会立刻落回
 * localStorage，下次打开就不用再补 —— 不用另写迁移脚本。
 */
export function useStoredState<T>(
  key: string,
  initial: T,
  normalize?: (value: T) => T,
) {
  const [value, setValue] = useState<T>(() => {
    const raw = readKey(key, initial)
    return normalize ? normalize(raw) : raw
  })

  useEffect(() => {
    writeKey(key, value)
  }, [key, value])

  return [value, setValue] as const
}

/**
 * 旧版目标是一周一条（{ weekKey, text, done, settled }），没有「周期」这一层。
 * 这里按 weekKey 分组，每组升成一个周期「10.26 那周」，每条老目标变成周期里的一条：
 * 结算过且打了勾的算完成，其余算没完成 —— 一条都不丢。
 * 已经是新形状（带 periodId）就原样不动。
 */
function migrateLegacyGoals(): void {
  const raw = readKey<unknown>(KEYS.goals, null)
  if (!Array.isArray(raw) || raw.length === 0) return

  const legacy = raw.filter(isLegacyGoal)
  if (legacy.length === 0) return

  const groups = new Map<string, LegacyGoal[]>()
  legacy.forEach(item => {
    const list = groups.get(item.weekKey) ?? []
    list.push(item)
    groups.set(item.weekKey, list)
  })

  const periods: GoalPeriod[] = []
  const goals: Goal[] = []
  let seq = 1

  // weekKey 排序后建周期，读日志时顺序跟当年写目标的顺序一致
  ;[...groups.keys()].sort().forEach(weekKey => {
    const periodId = seq++
    periods.push({
      id: periodId,
      title: legacyPeriodTitle(weekKey),
      start: weekKey,
      end: dayKeyOffset(weekKey, 6),
    })

    ;(groups.get(weekKey) ?? []).forEach(item => {
      const text = typeof item.text === 'string' ? item.text.trim() : ''
      if (!text) return
      goals.push({
        id: seq++,
        periodId,
        text,
        // 旧版只有点过「完成 / 没完成」的才算数，没结算的一律当没完成
        done: Boolean(item.settled && item.done),
      })
    })
  })

  writeKey(KEYS.goalPeriods, periods)
  writeKey(KEYS.goals, goals)
}

/**
 * 最终目标从 `workbench.finalGoal` 改成 `workbench.vision`。
 * 只在 vision 还空着的时候搬一次，老键保留不删 —— 跟 todos 那次一个规矩，
 * 用户已经写过的那句话不会因为换个键名就消失。
 */
function migrateLegacyVision(): void {
  const legacy = readKey<unknown>(LEGACY_VISION_KEY, '')
  if (typeof legacy !== 'string' || !legacy.trim()) return

  const current = readKey<unknown>(KEYS.vision, '')
  if (typeof current === 'string' && current.trim()) return

  writeKey(KEYS.vision, legacy)
}

/**
 * 老版本的待办存在 'todos' 里，这里搬到 'workbench.todos'，
 * 保证改造前加的待办不会丢。老 key 保留不删。
 */
export function migrateLegacyStorage(): void {
  migrateLegacyVision()
  migrateLegacyGoals()

  const legacy = readKey<unknown>('todos', null)
  if (!Array.isArray(legacy)) return

  // 已经有新数据了就以新数据为准
  if (readKey<Todo[] | null>(KEYS.todos, null) !== null) return

  // 老数据没有 subjectId / createdAt，补齐后归到「未分类」
  writeKey(KEYS.todos, normalizeTodos(legacy))
}
