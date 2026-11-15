import { useEffect, useState } from 'react'
import { appendAchievements, normalizeAchievements } from './achievements'
import { EMPTY_CAREER, normalizeCareer } from './career'
import { goalsToDrafts, isLegacyGoal, weeklyGoalsToData } from './legacyGoals'
import { applyPresetRoadmap } from './roadmap'
import { normalizeStages, presetStages } from './stages'
import { normalizeTodos } from './todos'
import type { Todo } from './types'

/** localStorage 的几个 key，分开存，互不影响 */
export const KEYS = {
  todos: 'workbench.todos',
  deadlines: 'workbench.deadlines',
  notes: 'workbench.notes',
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
  /** 里程碑（目标页），数组。老的目标条目也搬进这里，全站只剩这一套 */
  achievements: 'workbench.achievements',
  /** 目标页最上面那行「最终目标」（vision），只有一个字符串 */
  vision: 'workbench.vision',
  /**
   * 职业目标：{ vision, role, targetDate }。首页顶部那张卡读的就是它。
   * 老数据在 `workbench.vision` / `workbench.finalGoal`，迁移时抄一次，老键不删。
   */
  career: 'workbench.career',
  /** 复盘：每周一条，{ weekStart, best, stuck, next, ... } 的数组 */
  reviews: 'workbench.reviews',
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

/**
 * 目标条目（扁平那一列）的老键。已经不读也不写了，只在启动时搬一次，
 * 搬完保留不删 —— 用户原来的条目还在，万一搬错还能找回来。
 */
const LEGACY_GOALS_KEY = 'workbench.goals'

/**
 * 已经搬过的老目标 token：普通目标条目的原 id（没 id 的用 `idx-下标`），
 * 一周一条那批用 `w<id>` / `w-idx-<周>-<下标>`。
 *
 * 迁移只做一次：用户之后把搬进来的里程碑删掉、或者清空 achievements，
 * 都不会因为「goals 还在」又长出来一遍。这个键本身也跟着云同步走。
 */
const MERGED_GOALS_KEY = 'workbench.legacyGoalsMerged'

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
 * 已经搬过的老目标 token（原 goal id / `idx-下标` / 周目标的 `w<id>`）。
 * 两个迁移函数共用这一份记录，读一次、追加一次。
 */
function readMergedTokens(): Set<string> {
  const raw = readKey<unknown>(MERGED_GOALS_KEY, [])
  return new Set(
    (Array.isArray(raw) ? raw : []).filter((item): item is string => typeof item === 'string'),
  )
}

function rememberTokens(previous: Set<string>, fresh: string[]): void {
  if (fresh.length === 0) return
  writeKey(MERGED_GOALS_KEY, [...previous, ...fresh])
}

/**
 * 极老的数据是一周一条（{ weekKey, text, done, settled }），没有「阶段」这一层。
 * 这里按 weekKey 分组升出阶段「10.26 那周」，每条直接变成那个阶段下的一条里程碑。
 *
 * 以前这一步是先写 `workbench.goals`，再由下面那步并进里程碑；现在中间那份不用再生成了。
 */
function migrateWeeklyGoals(): void {
  const raw = readKey<unknown>(LEGACY_GOALS_KEY, null)
  if (!Array.isArray(raw) || raw.length === 0) return
  if (!raw.some(isLegacyGoal)) return

  const merged = readMergedTokens()
  const existingStages = normalizeStages(readKey<unknown>(KEYS.stages, []))
  // 新阶段的 id 从现有最大值往上排（跟 appendAchievements 一个规矩），不覆盖已有阶段
  const base = existingStages.reduce((acc, stage) => (stage.id > acc ? stage.id : acc), Date.now()) + 1

  const { stages, drafts, tokens } = weeklyGoalsToData(raw, merged, Date.now(), base)
  if (tokens.length === 0) return

  if (stages.length > 0) writeKey(KEYS.stages, [...existingStages, ...stages])
  const existing = normalizeAchievements(readKey<unknown>(KEYS.achievements, []))
  writeKey(KEYS.achievements, appendAchievements(existing, drafts))
  rememberTokens(merged, tokens)
}

/**
 * 把 `workbench.goals` 里剩下的目标条目并进里程碑 —— 之后全站只读写 achievements。
 *
 * 每条：title 取 text、stageId 原样保留（0 这种「未分组」落成没有阶段）、
 * done 过的记 status='done' 并补 doneAt（阶段表头的 x/y 认的是 doneAt）、
 * criteria 和 evidence 留空。
 *
 * 幂等靠 MERGED_GOALS_KEY 记 token，不靠「goals 空了没有」——老键按要求保留不删。
 * 搬进来的条目一律拿新 id（appendAchievements），不沿用目标 id。
 */
function mergeGoalsIntoAchievements(): void {
  const raw = readKey<unknown>(LEGACY_GOALS_KEY, null)
  if (!Array.isArray(raw) || raw.length === 0) return

  const merged = readMergedTokens()
  const { drafts, tokens } = goalsToDrafts(raw, merged)
  if (tokens.length === 0) return

  const existing = normalizeAchievements(readKey<unknown>(KEYS.achievements, []))
  writeKey(KEYS.achievements, appendAchievements(existing, drafts))
  rememberTokens(merged, tokens)
}

/**
 * 阶段这个键从无到有：老数据在 `workbench.goalPeriods`（字段是 start / end），
 * 搬过来顺手补上 order；一条老数据都没有才预置四个阶段。
 *
 * 全新安装走不到预置这一步 —— 上面 seedFirstRoadmap 已经把整套路线写好了，
 * 这里只是给「有别的数据、但从来没有阶段」的老用户兜底。
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
 * 职业目标从「一句话」升级成三样（愿景 / 角色 / 目标日期），存在新键
 * `workbench.career` 里。第一次打开时把老的 vision（再早是 finalGoal）
 * 抄进 career.vision —— 用户写过的那句话不会因为换了个结构就消失。
 *
 * 判断同样是「键在不在」：三样都被清空也会写 `{vision:'',...}` 回来，
 * 下次不会又把老愿景抄一遍。
 */
function migrateCareer(): void {
  if (readKey<unknown>(KEYS.career, null) !== null) return

  const current = readKey<unknown>(KEYS.vision, '')
  const older = readKey<unknown>(LEGACY_VISION_KEY, '')
  const vision =
    typeof current === 'string' && current.trim()
      ? current
      : typeof older === 'string'
        ? older
        : ''

  writeKey(KEYS.career, normalizeCareer({ vision }))
}

/**
 * 全新安装：手上一点数据都没有的时候，直接把整条「我的路线」写进去 ——
 * 四个阶段 + 第一阶段的三个里程碑 + 职业目标默认值（见 lib/roadmap.ts）。
 *
 * 判断看的是**三个键都不存在**（再加上没有更老的目标/周期数据）：
 * 只要用户已经有任何一份东西，就不自动写。删掉的阶段、清空的里程碑
 * 不该因为刷新一下又长回来 —— 想再要回来，设置页那个按钮可以手动补。
 *
 * 必须排在 migrateCareer 之后（那一步会无条件建 career 键，但会把老愿景
 * 先搬进来，这里只填空行，不会覆盖）、migrateStages 之前（写完 stages 键，
 * 那一步就会认为「已经有了」而跳过）。
 */
function isBlankInstall(): boolean {
  if (readKey<unknown>(KEYS.stages, null) !== null) return false
  if (readKey<unknown>(KEYS.career, null) !== null) return false
  if (normalizeAchievements(readKey<unknown>(KEYS.achievements, [])).length > 0) return false
  // 还有老的「周期」或者极老的一周一条目标，就不算全新 —— 交给后面几个迁移去搬
  if (readKey<unknown>(LEGACY_PERIODS_KEY, null) !== null) return false
  const legacyGoals = readKey<unknown>(LEGACY_GOALS_KEY, null)
  return !Array.isArray(legacyGoals) || legacyGoals.length === 0
}

function seedFirstRoadmap(): void {
  const result = applyPresetRoadmap({ stages: [], achievements: [], career: EMPTY_CAREER })
  writeKey(KEYS.stages, result.stages)
  writeKey(KEYS.achievements, result.achievements)
  writeKey(KEYS.career, result.career)
}

/**
 * 老版本的待办存在 'todos' 里，这里搬到 'workbench.todos'，
 * 保证改造前加的待办不会丢。老 key 保留不删。
 */
export function migrateLegacyStorage(): void {
  // 先判断「是不是全新」，之后每一步都可能建键，判断就不准了
  const blank = isBlankInstall()

  migrateLegacyVision()
  migrateCareer()
  // 顺序有讲究：先把极老的一周一条目标升成阶段（会写 stages），
  // 再搬「周期 → 阶段」，最后才可能预置；然后才把目标条目并进里程碑
  migrateWeeklyGoals()
  if (blank) seedFirstRoadmap()
  migrateStages()
  mergeGoalsIntoAchievements()

  const legacy = readKey<unknown>('todos', null)
  if (!Array.isArray(legacy)) return

  // 已经有新数据了就以新数据为准
  if (readKey<Todo[] | null>(KEYS.todos, null) !== null) return

  // 老数据没有 subjectId / createdAt，补齐后归到「未分类」
  writeKey(KEYS.todos, normalizeTodos(legacy))
}
