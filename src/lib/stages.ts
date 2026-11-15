import { dayKey, formatDateRange } from './date'
import type { Achievement, Stage } from './types'

/**
 * 阶段。目标页上**唯一**的一条时间轴：里程碑都挂在它下面。
 *
 * 以前叫「周期」（GoalPeriod，字段 start / end），只挂目标条目；
 * 目标条目并进里程碑之后，它只负责给里程碑分组。
 * 老数据由 storage.ts 的 migrateStages 搬一次，字段名在这里兜底兼容。
 *
 * 除读写 localStorage 的部分外都是纯函数，能单独跑测试。
 */

/** 没归阶段的里程碑落到这里（`stageId` 缺省或指向已删的阶段）。阶段 id 由时间戳生成，不可能是 0 */
export const UNSORTED_STAGE_ID = 0
export const UNSORTED_STAGE_TITLE = '未归类'

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_RE.test(value)
}

/** 起止写反了就换过来，不因为一个手误把整条丢掉 */
export function orderRange(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a]
}

/* ---------- 读盘 ---------- */

/**
 * 一条阶段长什么样都可能，逐个字段兜底。标题或起止缺一个就整条丢掉
 * （没有起止的阶段算不出「当前是哪个」，页面上也没法标时间）。
 *
 * 兼容老形状：`start` / `end` 也认，`order` 缺了就按数组下标。
 */
export function normalizeStage(raw: unknown, index = 0, now: number = Date.now()): Stage | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Stage> & { start?: unknown; end?: unknown }

  const title = typeof item.title === 'string' ? item.title.trim() : ''
  const startKey = isDateKey(item.startKey)
    ? item.startKey
    : isDateKey(item.start)
      ? item.start
      : ''
  const endKey = isDateKey(item.endKey) ? item.endKey : isDateKey(item.end) ? item.end : ''
  if (!title || !startKey || !endKey) return null

  const [start, end] = orderRange(startKey, endKey)
  const id = typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : now + index
  const order = typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : index

  return { id, title, startKey: start, endKey: end, order }
}

export function normalizeStages(list: unknown, now: number = Date.now()): Stage[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item, index) => normalizeStage(item, index, now))
    .filter((item): item is Stage => item !== null)
}

/* ---------- 写 ---------- */

/** 新 id：同一毫秒里连点两次也不会撞 */
export function nextStageId(list: Stage[], now: number = Date.now()): number {
  const max = list.reduce((acc, item) => (item.id > acc ? item.id : acc), 0)
  return now > max ? now : max + 1
}

/** 新阶段排在最末尾，不插队 */
export function nextStageOrder(list: Stage[]): number {
  return list.reduce((acc, item) => (item.order > acc ? item.order : acc), -1) + 1
}

export function addStage(
  list: Stage[],
  input: { title: string; startKey: string; endKey: string },
  now: number = Date.now(),
): Stage[] {
  const title = input.title.trim()
  if (!title || !isDateKey(input.startKey) || !isDateKey(input.endKey)) return list
  const [startKey, endKey] = orderRange(input.startKey, input.endKey)
  return [
    ...list,
    { id: nextStageId(list, now), title, startKey, endKey, order: nextStageOrder(list) },
  ]
}

/** 改标题和起止。order 不动 —— 改名不该让阶段在页面上换位置 */
export function updateStage(
  list: Stage[],
  id: number,
  patch: { title?: string; startKey?: string; endKey?: string },
): Stage[] {
  return list.map(stage => {
    if (stage.id !== id) return stage
    const title = patch.title === undefined ? stage.title : patch.title.trim()
    if (!title) return stage
    const rawStart = patch.startKey ?? stage.startKey
    const rawEnd = patch.endKey ?? stage.endKey
    if (!isDateKey(rawStart) || !isDateKey(rawEnd)) return stage
    const [startKey, endKey] = orderRange(rawStart, rawEnd)
    return { ...stage, title, startKey, endKey }
  })
}

/**
 * 删阶段：它下面的里程碑一起删，并把被删的里程碑 id 交出去 ——
 * 页面拿这份 id 去把任务的 achievementId 摘掉（任务本身保留）。
 */
export function removeStage(
  stages: Stage[],
  achievements: Achievement[],
  id: number,
): { stages: Stage[]; achievements: Achievement[]; removedAchievementIds: number[] } {
  const removedAchievementIds = achievements
    .filter(item => item.stageId === id)
    .map(item => item.id)

  return {
    stages: stages.filter(stage => stage.id !== id),
    achievements: achievements.filter(item => item.stageId !== id),
    removedAchievementIds,
  }
}

/* ---------- 排序与时间 ---------- */

/** order 小的在前；order 打平（老数据）就按开始日期、再按 id */
export function sortStages(list: Stage[]): Stage[] {
  return [...list].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    if (a.startKey !== b.startKey) return a.startKey.localeCompare(b.startKey)
    return a.id - b.id
  })
}

/** 这一天落不落在这个阶段里（起止都含当天） */
export function stageCovers(stage: Stage, dateKey: string): boolean {
  return dateKey >= stage.startKey && dateKey <= stage.endKey
}

export type StageState = 'upcoming' | 'running' | 'past'

export function stageState(stage: Stage, now: number = Date.now()): StageState {
  const today = dayKey(now)
  if (today < stage.startKey) return 'upcoming'
  if (today > stage.endKey) return 'past'
  return 'running'
}

/**
 * 今天是哪个阶段。阶段之间允许重叠，取**开始得更晚**的那个 ——
 * 学期里套一个寒假时，1 月 20 日更该盯的是寒假（内层更具体）。
 * 开始日期也一样（同一段被建了两遍）就取结束早的那条。
 */
export function currentStage(list: Stage[], now: number = Date.now()): Stage | undefined {
  const today = dayKey(now)
  return list
    .filter(stage => stageCovers(stage, today))
    .reduce<Stage | undefined>((acc, stage) => {
      if (!acc) return stage
      if (stage.startKey !== acc.startKey) return stage.startKey > acc.startKey ? stage : acc
      return stage.endKey < acc.endKey ? stage : acc
    }, undefined)
}

/* ---------- 里程碑归属 ---------- */

/** 某个阶段下的里程碑，按添加顺序 —— 跟卡片出现的顺序一致 */
export function achievementsOf(list: Achievement[], stageId: number): Achievement[] {
  return list.filter(item => (item.stageId ?? UNSORTED_STAGE_ID) === stageId)
}

/** 没有 stageId、或者挂的阶段已经被删掉的，都算未归类 */
export function orphanAchievements(list: Achievement[], stages: Stage[]): Achievement[] {
  const ids = new Set(stages.map(stage => stage.id))
  return list.filter(item => item.stageId === undefined || !ids.has(item.stageId))
}

export type StageStats = {
  /** 已点亮的里程碑数 */
  done: number
  /** 这个阶段下的里程碑总数 */
  total: number
  /** 0-100 的整数。total 为 0 时给 0 */
  percent: number
}

/** 阶段表头上的 x/y：已点亮里程碑数 / 里程碑总数（不是任务数） */
export function stageStats(list: Achievement[], stageId: number): StageStats {
  const items = achievementsOf(list, stageId)
  const done = items.filter(item => item.doneAt !== undefined).length
  const total = items.length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/* ---------- 展示 ---------- */

/** 阶段上的日期写成 10.26 - 11.01（跨年时两头带年份） */
export function stageRangeText(stage: { startKey: string; endKey: string }): string {
  return formatDateRange(stage.startKey, stage.endKey)
}
