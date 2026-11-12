import { useEffect, useState } from 'react'
import { dayKeyOffset } from './date'
import { isLegacyGoal, legacyPeriodTitle } from './goals'
import type { LegacyGoal } from './goals'
import { normalizeStages, presetStages } from './stages'
import { normalizeTodos } from './todos'
import type { Goal, Stage, Todo } from './types'

/** localStorage 的几个 key，分开存，互不影响 */
export const KEYS = {
  todos: 'workbench.todos',
  deadlines: 'workbench.deadlines',
  notes: 'workbench.notes',
  /** 目标条目：{ id, stageId, text, done, doneAt? }，挂在对应的阶段上 */
  goals: 'workbench.goals',
  /** 阶段：大一上 / 大一下 / …，{ id, title, startKey, endKey, order } */
  stages: 'workbench.stages',
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
  /** 知识库：{ id, type, title, url?, summary, createdAt } 的数组 */
  knowledge: 'workbench.knowledge',
  /** 行业动态的缓存：{ fetchedAt, items }。几 KB，跟着云同步一起走 */
  feedCache: 'workbench.feedCache',
} as const

/** 旧版的最终目标键，只在迁移时读一次，搬完保留不删 */
const LEGACY_VISION_KEY = 'workbench.finalGoal'

/**
 * 阶段之前叫「周期」，存在这个键里。只在迁移时读一次，
 * 搬完不删 —— 跟其它几次迁移一个规矩，万一搬错还能找回来。
 */
const LEGACY_PERIODS_KEY = 'workbench.goalPeriods'

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
 * 旧版目标是一周一条（{ weekKey, text, done, settled }），没有「阶段」这一层。
 * 这里按 weekKey 分组，每组升成一个阶段「10.26 那周」，每条老目标变成阶段里的一条：
 * 结算过且打了勾的算完成，其余算没完成 —— 一条都不丢。
 * 已经是新形状（带 stageId / periodId）就原样不动。
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

  const stages: Stage[] = []
  const goals: Goal[] = []
  let seq = 1

  // weekKey 排序后建阶段，读日志时顺序跟当年写目标的顺序一致
  ;[...groups.keys()].sort().forEach((weekKey, index) => {
    const stageId = seq++
    stages.push({
      id: stageId,
      title: legacyPeriodTitle(weekKey),
      startKey: weekKey,
      endKey: dayKeyOffset(weekKey, 6),
      order: index,
    })

    ;(groups.get(weekKey) ?? []).forEach(item => {
      const text = typeof item.text === 'string' ? item.text.trim() : ''
      if (!text) return
      goals.push({
        id: seq++,
        stageId,
        text,
        // 旧版只有点过「完成 / 没完成」的才算数，没结算的一律当没完成
        done: Boolean(item.settled && item.done),
      })
    })
  })

  writeKey(KEYS.stages, stages)
  writeKey(KEYS.goals, goals)
}

/**
 * 阶段这个键从无到有：老数据在 `workbench.goalPeriods`（字段是 start / end），
 * 搬过来顺手补上 order；一条老数据都没有才预置四个阶段。
 *
 * 判断用「键在不在」而不是「数组空不空」：用户把阶段全删了，
 * useStoredState 会把 `[]` 写回去，下次读到的是空数组而不是 null，
 * 所以删掉的阶段不会自己长回来。
 */
function migrateStages(): void {
  if (readKey<unknown>(KEYS.stages, null) !== null) return

  const legacy = readKey<unknown>(LEGACY_PERIODS_KEY, null)
  if (Array.isArray(legacy)) {
    writeKey(KEYS.stages, normalizeStages(legacy))
    return
  }

  writeKey(KEYS.stages, presetStages())
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
  // 先搬极老的一周一条目标（会写 stages），再搬「周期 → 阶段」，最后才可能预置
  migrateLegacyGoals()
  migrateStages()

  const legacy = readKey<unknown>('todos', null)
  if (!Array.isArray(legacy)) return

  // 已经有新数据了就以新数据为准
  if (readKey<Todo[] | null>(KEYS.todos, null) !== null) return

  // 老数据没有 subjectId / createdAt，补齐后归到「未分类」
  writeKey(KEYS.todos, normalizeTodos(legacy))
}
