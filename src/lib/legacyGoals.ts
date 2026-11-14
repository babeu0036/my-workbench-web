import { dayKeyOffset } from './date'
import { UNSORTED_STAGE_ID } from './stages'
import type { AchievementDraft, Stage } from './types'

/**
 * 「目标条目」这个概念已经并进里程碑了，全站只有 achievements 一套。
 * 这个文件只被 storage.ts 的启动迁移读一次，页面里没有任何地方引用。
 *
 * 两种老形状都要认：
 * 1. 最早的一周一条 `{ id, weekKey, text, done, settled }`：那时还没有阶段这一层，
 *    迁移时按 weekKey 升出阶段，每条变成一个里程碑、挂在那个阶段下；
 * 2. 后来的目标条目 `{ id, stageId|periodId, text, done, doneAt? }`：阶段已经有了，
 *    直接把每条并进对应阶段的里程碑列表，stageId 原样保留。
 *
 * 两边都只产出「草稿」（没有 id）：id 由 storage 那边按现有最大值统一分配，
 * 免得搬进来的条目跟已有里程碑撞号。
 */

/* ---------- 一周一条的老目标 ---------- */

export type LegacyWeeklyGoal = {
  id?: number
  weekKey: string
  text: string
  done?: boolean
  settled?: boolean
}

export function isLegacyGoal(raw: unknown): raw is LegacyWeeklyGoal {
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

/**
 * 一周一条的时代整批搬过来：weekKey 分组 → 一个阶段，
 * 组里每条 → 一个里程碑（只有「结算过且打了勾」的算完成，跟当年一致）。
 *
 * `skip` 是已经搬过的 token（`w<id>` / `w-idx-<周>-<下标>`），跟目标条目共用一个
 * 记录键 —— 搬过一次就不再搬，用户之后删掉里程碑也不会长回来。
 * `stageIdBase` 给新阶段的起始 id，调用方按现有阶段算好传进来，免得撞号。
 */
export function weeklyGoalsToData(
  raw: unknown,
  skip: Set<string> = new Set(),
  now: number = Date.now(),
  stageIdBase: number = now,
): { stages: Stage[]; drafts: AchievementDraft[]; tokens: string[] } {
  const stages: Stage[] = []
  const drafts: AchievementDraft[] = []
  const tokens: string[] = []
  if (!Array.isArray(raw)) return { stages, drafts, tokens }

  const groups = new Map<string, { item: LegacyWeeklyGoal; index: number }[]>()
  raw.forEach((value, index) => {
    if (!isLegacyGoal(value)) return
    const list = groups.get(value.weekKey) ?? []
    list.push({ item: value, index })
    groups.set(value.weekKey, list)
  })

  // weekKey 排序后建阶段，读日志时顺序跟当年写目标的顺序一致
  ;[...groups.keys()].sort().forEach((weekKey, order) => {
    let stageId = 0
    let stagePushed = false

    ;(groups.get(weekKey) ?? []).forEach(({ item, index }) => {
      const token =
        typeof item.id === 'number' && Number.isFinite(item.id)
          ? `w${item.id}`
          : `w-idx-${weekKey}-${index}`
      if (skip.has(token)) return

      const title = typeof item.text === 'string' ? item.text.trim() : ''
      if (!title) return

      // 这一周第一次真的有东西要搬，才建阶段（全被 skip 掉的话不建空阶段）
      if (!stagePushed) {
        stageId = stageIdBase + stages.length
        stages.push({
          id: stageId,
          title: legacyPeriodTitle(weekKey),
          startKey: weekKey,
          endKey: dayKeyOffset(weekKey, 6),
          order,
        })
        stagePushed = true
      }

      const done = Boolean(item.settled && item.done)
      drafts.push({
        title,
        criteria: '',
        evidence: '',
        status: done ? 'done' : 'todo',
        stageId,
        // 那会儿没记完成时间，补迁移这一刻 —— 阶段表头的 x/y 认的是 doneAt
        ...(done ? { doneAt: now } : {}),
      })
      tokens.push(token)
    })
  })

  return { stages, drafts, tokens }
}

/* ---------- 后来的目标条目 ---------- */

/**
 * 把 `workbench.goals` 里的每条目标翻成一条里程碑草稿。
 *
 * `skip` 是已经搬过的 token（存在 `workbench.legacyGoalsMerged` 里）：
 * 迁移只做一次，用户后来把里程碑删光了也不会又冒出来一遍。
 * `tokens` 是这次真正搬成功的那些，调用方负责并进 skip。
 */
export function goalsToDrafts(
  raw: unknown,
  skip: Set<string> = new Set(),
  now: number = Date.now(),
): { drafts: AchievementDraft[]; tokens: string[] } {
  const drafts: AchievementDraft[] = []
  const tokens: string[] = []
  if (!Array.isArray(raw)) return { drafts, tokens }

  const seen = new Set(skip)

  raw.forEach((value, index) => {
    if (!value || typeof value !== 'object') return
    // 一周一条的（带 weekKey）归 weeklyGoalsToData 管，这里不能重复搬
    if (isLegacyGoal(value)) return
    const item = value as {
      id?: unknown
      text?: unknown
      criteria?: unknown
      done?: unknown
      doneAt?: unknown
      stageId?: unknown
      periodId?: unknown
    }

    const title = typeof item.text === 'string' ? item.text.trim() : ''
    // 认不出是什么的条目跳过，也不记 token（万一以后能认了还能再搬一次）
    if (!title) return

    // 没有 id 的老数据用下标当 token，同一个下标只会搬一次
    const token =
      typeof item.id === 'number' && Number.isFinite(item.id) ? String(item.id) : `idx-${index}`
    if (seen.has(token)) return
    seen.add(token)

    // 阶段：老字段是 periodId；0 是「未分组」的哨兵，落成「没有 stageId」
    const rawStage = typeof item.stageId === 'number' ? item.stageId : item.periodId
    const stageId =
      typeof rawStage === 'number' && Number.isFinite(rawStage) && rawStage !== UNSORTED_STAGE_ID
        ? rawStage
        : undefined

    const done = Boolean(item.done)
    // 勾过的补一个完成时间：算「已点亮」的地方看的是 doneAt，不是 done 这个布尔
    const doneAt = done
      ? typeof item.doneAt === 'number' && Number.isFinite(item.doneAt)
        ? item.doneAt
        : now
      : undefined

    drafts.push({
      title,
      criteria: typeof item.criteria === 'string' ? item.criteria.trim() : '',
      evidence: '',
      status: done ? 'done' : 'todo',
      ...(stageId !== undefined ? { stageId } : {}),
      ...(doneAt !== undefined ? { doneAt } : {}),
    })
    tokens.push(token)
  })

  return { drafts, tokens }
}
