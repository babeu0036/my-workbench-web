import { MILESTONE_SHORT_MAX } from './milestones'
import type { Achievement, MilestoneStatus, Todo } from './types'

/**
 * 成就（也就是「里程碑」）。目标页上的大块，一条下面挂若干任务：
 *
 * - `Todo.achievementId` 硬关联：任务只活在目标页；
 * - `Todo.goalId` 软关联：任务照旧留在首页 / 计划 / 科目页，也顺便算进度。
 *
 * 这里只放纯函数：读盘兜底、增删、证据门槛。**进度和状态不在这里算** ——
 * 那些要同时看任务，统一在 lib/milestones.ts。
 *
 * 跟更早版本的区别：以前任务全勾完就自动点亮（withLitState），现在不会了，
 * 全勾完只是「待确认」，得人写一句证据再点「标记完成」。
 */

const STATUSES: MilestoneStatus[] = ['todo', 'doing', 'done']

/** 一条成就长什么样都可能，逐个字段兜底；没有标题的直接丢掉（认不出是什么） */
export function normalizeAchievement(raw: unknown, index = 0): Achievement | null {
  if (!raw || typeof raw !== 'object') return null
  // note / done 是更早版本的字段：note 就是现在的「判断标准」，搬过来不丢
  const item = raw as Partial<Achievement> & { note?: unknown; done?: unknown }

  const title = typeof item.title === 'string' ? item.title.trim() : ''
  if (!title) return null

  const id =
    typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : Date.now() + index
  const criteria = (
    typeof item.criteria === 'string'
      ? item.criteria
      : typeof item.note === 'string'
        ? item.note
        : ''
  ).trim()
  const evidence = typeof item.evidence === 'string' ? item.evidence.trim() : ''
  // 短名只在真写了的时候留：空字符串存下来没意义，删掉键就回到「自动取标题前 4 字」
  const short = typeof item.short === 'string' ? item.short.trim().slice(0, MILESTONE_SHORT_MAX) : ''
  const stageId =
    typeof item.stageId === 'number' && Number.isFinite(item.stageId) ? item.stageId : undefined
  const doneAt =
    typeof item.doneAt === 'number' && Number.isFinite(item.doneAt) ? item.doneAt : undefined

  // 有 doneAt 就是已完成（老数据是自动点亮的，不能因为没写 status 就退回未完成）
  const stored = STATUSES.includes(item.status as MilestoneStatus)
    ? (item.status as MilestoneStatus)
    : undefined
  const status: MilestoneStatus = doneAt !== undefined ? 'done' : (stored ?? 'todo')

  return {
    id,
    title,
    criteria,
    evidence,
    status,
    // 没有阶段就不写这个键：目标页会把它放进「未归类」
    ...(stageId !== undefined ? { stageId } : {}),
    ...(doneAt !== undefined ? { doneAt } : {}),
    ...(short ? { short } : {}),
  }
}

export function normalizeAchievements(list: unknown): Achievement[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item, index) => normalizeAchievement(item, index))
    .filter((item): item is Achievement => item !== null)
}

/** 新成就的 id：同一毫秒里连点两次也不会撞 */
export function nextAchievementId(list: Achievement[], now: number = Date.now()): number {
  const max = list.reduce((acc, item) => (item.id > acc ? item.id : acc), 0)
  return now > max ? now : max + 1
}

/** 加一条成就。标题是唯一必填项，判断标准、证据、阶段都可以空 */
export function addAchievement(
  list: Achievement[],
  title: string,
  criteria = '',
  stageId?: number,
  now: number = Date.now(),
): Achievement[] {
  const value = title.trim()
  if (!value) return list
  return [
    ...list,
    {
      id: nextAchievementId(list, now),
      title: value,
      criteria: criteria.trim(),
      evidence: '',
      status: 'todo',
      ...(stageId !== undefined ? { stageId } : {}),
    },
  ]
}

/**
 * 改标题 / 判断标准 / 证据 / 短名。标题不能被改空；
 * 标准和证据可以改空（还没想清楚就先空着，卡片上显示灰字提示）；
 * 短名改空就删掉这个键，回到自动取标题前 4 个字。
 */
export function updateAchievement(
  list: Achievement[],
  id: number,
  patch: { title?: string; short?: string; criteria?: string; evidence?: string },
): Achievement[] {
  return list.map(item => {
    if (item.id !== id) return item

    const next = { ...item }
    if (patch.title !== undefined) {
      const title = patch.title.trim()
      if (!title) return item
      next.title = title
    }
    if (patch.short !== undefined) {
      const short = patch.short.trim().slice(0, MILESTONE_SHORT_MAX)
      if (short) next.short = short
      else delete next.short
    }
    if (patch.criteria !== undefined) next.criteria = patch.criteria.trim()
    if (patch.evidence !== undefined) next.evidence = patch.evidence.trim()
    return next
  })
}

export function removeAchievement(list: Achievement[], id: number): Achievement[] {
  return list.filter(item => item.id !== id)
}

/**
 * 删成就时任务不跟着删：把 achievementId 和 goalId 都摘掉，它们退回普通任务
 * （subjectId 本来就是空的，摘掉标记就会出现在计划·任务里）。
 *
 * 收单个 id 或一批 id —— 删阶段时它下面可能有若干条成就。
 */
export function detachTasks(todos: Todo[], id: number | number[]): Todo[] {
  const ids = new Set(Array.isArray(id) ? id : [id])
  if (ids.size === 0) return todos

  let changed = false
  const next = todos.map(todo => {
    const hard = todo.achievementId !== undefined && ids.has(todo.achievementId)
    const soft = todo.goalId !== undefined && ids.has(todo.goalId)
    if (!hard && !soft) return todo

    changed = true
    const rest = { ...todo }
    if (hard) delete rest.achievementId
    if (soft) delete rest.goalId
    return rest
  })
  return changed ? next : todos
}

/** 证据写了没有。空字符串、全是空格都算没写 */
export function hasEvidence(item: Achievement): boolean {
  return item.evidence.trim().length > 0
}

/**
 * 标记完成。证据为空时**原样返回**（返回同一个数组引用，App 里能靠这个判断
 * 要不要写盘），按钮那边也会禁用，两层都拦住。
 */
export function markAchievementDone(
  list: Achievement[],
  id: number,
  now: number = Date.now(),
): Achievement[] {
  const target = list.find(item => item.id === id)
  if (!target || !hasEvidence(target) || target.status === 'done') return list

  return list.map(item => (item.id === id ? { ...item, status: 'done', doneAt: now } : item))
}

/** 撤销完成：状态退回未确认，时间戳删掉，证据和标准都留着 */
export function reopenAchievement(list: Achievement[], id: number): Achievement[] {
  return list.map(item => {
    if (item.id !== id || item.status !== 'done') return item
    const rest = { ...item, status: 'todo' as MilestoneStatus }
    delete rest.doneAt
    return rest
  })
}
