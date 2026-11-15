import { dayKey, weekEnd, weekKeyOf, weekStart } from './date'
import { lastDoneAt, tasksOf } from './milestones'
import { sortStages } from './stages'
import type { Achievement, Review, ReviewDraft, ReviewGenerated, Stage, Todo } from './types'

/**
 * 每周复盘：一句话数字 + 没动的里程碑 + 三句话 + 历史。
 *
 * 全部是纯函数，写盘交给 App（`workbench.reviews`，以 workbench. 开头，
 * 所以现有同步逻辑会自动打包，这里不用也不该碰同步）。
 *
 * 一周一条，认的是 `weekStart`（周一日期键）。再保存就覆盖，不追加。
 */

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

/* ---------- 读盘 ---------- */

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeGenerated(list: unknown): ReviewGenerated[] {
  if (!Array.isArray(list)) return []
  const out: ReviewGenerated[] = []
  list.forEach(item => {
    if (!item || typeof item !== 'object') return
    const row = item as Partial<ReviewGenerated>
    if (typeof row.achievementId !== 'number' || !Number.isFinite(row.achievementId)) return
    if (typeof row.todoId !== 'number' || !Number.isFinite(row.todoId)) return
    // 同一条任务重复记了也只留一条
    if (out.some(entry => entry.todoId === row.todoId)) return
    out.push({ achievementId: row.achievementId, todoId: row.todoId })
  })
  return out
}

/** 一条复盘长什么样都可能：周起始日认不出来就整条丢掉（不知道该挂在哪一周） */
export function normalizeReview(raw: unknown, index = 0, now: number = Date.now()): Review | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Review>

  const weekStartKey =
    typeof item.weekStart === 'string' && WEEK_KEY_RE.test(item.weekStart) ? item.weekStart : ''
  if (!weekStartKey) return null

  return {
    id: num(item.id, now + index),
    weekStart: weekStartKey,
    best: text(item.best),
    stuck: text(item.stuck),
    next: text(item.next),
    movedCount: num(item.movedCount),
    totalCount: num(item.totalCount),
    generated: normalizeGenerated(item.generated),
    createdAt: num(item.createdAt, now),
  }
}

/** 读盘：坏条目丢掉；同一周有多条（老数据 / 手改过）时留 createdAt 更晚的那条 */
export function normalizeReviews(list: unknown, now: number = Date.now()): Review[] {
  if (!Array.isArray(list)) return []

  const byWeek = new Map<string, Review>()
  list.forEach((raw, index) => {
    const item = normalizeReview(raw, index, now)
    if (!item) return
    const prev = byWeek.get(item.weekStart)
    if (!prev || item.createdAt >= prev.createdAt) byWeek.set(item.weekStart, item)
  })
  return [...byWeek.values()]
}

/** 某一周的复盘，没有就 undefined */
export function reviewOf(list: Review[], weekStartKey: string): Review | undefined {
  return list.find(item => item.weekStart === weekStartKey)
}

/**
 * 复盘三句话的草稿（`workbench.reviewDraft`，只有一个对象）。
 *
 * 只认本周的那份：上周没写完的草稿不再往这周的空格子里灌，否则人会以为自己
 * 上周写的东西丢了 —— 它还在上周的历史里，或者干脆被新的草稿覆盖掉了。
 * 认不出 weekStart 就整份丢掉，宁可空着。
 */
export function normalizeReviewDraft(raw: unknown, weekStartKey: string): ReviewDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<ReviewDraft>
  if (typeof item.weekStart !== 'string' || !WEEK_KEY_RE.test(item.weekStart)) return null
  if (item.weekStart !== weekStartKey) return null
  return {
    weekStart: item.weekStart,
    best: text(item.best),
    stuck: text(item.stuck),
    next: text(item.next),
  }
}

/** 历史记录：按周倒序，最新的一周在最上面 */
export function sortedReviews(list: Review[]): Review[] {
  return [...list].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
}

/* ---------- 写 ---------- */

function nextReviewId(list: Review[], now: number): number {
  const max = list.reduce((acc, item) => (item.id > acc ? item.id : acc), 0)
  return now > max ? now : max + 1
}

export type ReviewInput = {
  weekStart: string
  best: string
  stuck: string
  next: string
  movedCount: number
  totalCount: number
  /** 这一次新记的任务；跟已有的合并，不会因为重存把「下周做它」抹掉 */
  generated?: ReviewGenerated[]
}

/**
 * 保存一周的复盘：这一周已经有记录就覆盖那一条（id 和 createdAt 保留），
 * 没有就追加一条。三句话允许全空 —— 只是先点了几次「下周做它」的时候，
 * 记录也得有个落点。
 */
export function saveReview(list: Review[], input: ReviewInput, now: number = Date.now()): Review[] {
  const existing = reviewOf(list, input.weekStart)
  const fresh = input.generated ?? []

  if (!existing) {
    return [
      ...list,
      {
        id: nextReviewId(list, now),
        weekStart: input.weekStart,
        best: input.best.trim(),
        stuck: input.stuck.trim(),
        next: input.next.trim(),
        movedCount: input.movedCount,
        totalCount: input.totalCount,
        generated: normalizeGenerated(fresh),
        createdAt: now,
      },
    ]
  }

  const merged = normalizeGenerated([...existing.generated, ...fresh])
  return list.map(item =>
    item.weekStart !== input.weekStart
      ? item
      : {
          ...item,
          best: input.best.trim(),
          stuck: input.stuck.trim(),
          next: input.next.trim(),
          movedCount: input.movedCount,
          totalCount: input.totalCount,
          generated: merged,
        },
  )
}

/**
 * 「下周做它」生成一条任务后，把 { achievementId, todoId } 记进本周。
 *
 * 本周还没有复盘记录时顺手建一条（三句话空着），否则这条记录无处可挂，
 * 按钮就没法变成「已加入下周」。同一条任务重复记只留一次。
 */
export function addGenerated(
  list: Review[],
  weekStartKey: string,
  entry: ReviewGenerated,
  snapshot: { movedCount: number; totalCount: number },
  now: number = Date.now(),
): Review[] {
  const existing = reviewOf(list, weekStartKey)
  if (!existing) {
    return saveReview(
      list,
      {
        weekStart: weekStartKey,
        best: '',
        stuck: '',
        next: '',
        movedCount: snapshot.movedCount,
        totalCount: snapshot.totalCount,
        generated: [entry],
      },
      now,
    )
  }
  if (existing.generated.some(item => item.todoId === entry.todoId)) return list
  return list.map(item =>
    item.weekStart !== weekStartKey
      ? item
      : { ...item, generated: [...item.generated, entry] },
  )
}

/* ---------- 本周数字 ---------- */

export type WeekClosure = {
  /** 本周完成的条数（doneAt 落在 [本周一, 下周一)） */
  done: number
  /** 其中挂了里程碑的（achievementId 或 goalId，跟里程碑进度的口径一致） */
  linked: number
  /** 0-100 的整数；done 为 0 时给 0，页面上显示「—」不显示 0% */
  percent: number
  /** 本周新建了多少条任务（createdAt 落在 [本周一, 下周一)） */
  created: number
}

/**
 * 本周完成了几条、其中几条挂在里程碑上。
 *
 * 「挂了里程碑」认 achievementId（目标页里建的任务）和 goalId（首页 / 计划里
 * 选了「服务于」的任务）两种，跟 lib/milestones.ts 的 tasksOf 一个口径 ——
 * 否则「下周做它」生成的任务勾完了，这里会当它没挂在任何里程碑上。
 */
export function weekClosure(todos: Todo[], now: number = Date.now()): WeekClosure {
  const start = weekStart(now)
  const end = weekEnd(now)
  const finished = todos.filter(
    todo => typeof todo.doneAt === 'number' && todo.doneAt >= start && todo.doneAt < end,
  )
  const linked = finished.filter(
    todo => todo.achievementId !== undefined || todo.goalId !== undefined,
  ).length
  const done = finished.length
  // 新加了几条：跟完成数是两个方向 —— 完成多说明在推进，新建多说明在铺摊子
  const created = todos.filter(
    todo => typeof todo.createdAt === 'number' && todo.createdAt >= start && todo.createdAt < end,
  ).length
  return {
    done,
    linked,
    percent: done === 0 ? 0 : Math.round((linked / done) * 100),
    created,
  }
}

/* ---------- 这周没动的里程碑 ---------- */

/** 两个本地零点之间的天数差，用来写「上次推进：3 天前」 */
export function daysSince(ts: number, now: number = Date.now()): number {
  const a = new Date(ts)
  const b = new Date(now)
  const startA = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const startB = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.max(0, Math.round((startB - startA) / DAY_MS))
}

export type StalledRow = {
  item: Achievement
  stageTitle: string
  /** 关联任务里最近一次完成的时间；从没完成过就是 undefined */
  last: number | undefined
  /** 距今天几天。last 为 undefined 时也是 undefined */
  days: number | undefined
}

export type ClosureScope = {
  /** 这周没动的里程碑，按阶段顺序；页面只显示前 3 条 */
  rows: StalledRow[]
  /** 本周推进过的里程碑数（这一层范围里） */
  movedCount: number
  /** 这一层范围里的里程碑总数（含已完成的） */
  totalCount: number
  /** 有没有可统计的里程碑 —— 没有时页面显示「还没有里程碑」那类空态 */
  hasMilestones: boolean
}

/**
 * 「当前阶段及之前」的范围：已经开始过的阶段（startKey <= 今天）。
 *
 * 今天落在两个阶段之间的空档（寒暑假、还没开学）时，按「已经开始的」算，
 * 比按「今天正落在里面」更稳 —— 否则假期里这一块会突然全空。
 * 一个都没开始（还没到第一阶段）就退回全部阶段，让人一打开就能看到东西。
 */
function scopeStages(stages: Stage[], now: number): Stage[] {
  const today = dayKey(now)
  const started = stages.filter(stage => stage.startKey <= today)
  return sortStages(started.length > 0 ? started : stages)
}

/**
 * 这周没动的里程碑：范围内还没完成的、而且关联任务本周没有任何完成。
 *
 * 「关联任务」跟卡片上的进度同源（achievementId 硬关联 + goalId 软关联），
 * 所以卡片上有推进、这里就不会把它列出来。
 */
export function closureScope(
  achievements: Achievement[],
  todos: Todo[],
  stages: Stage[],
  now: number = Date.now(),
): ClosureScope {
  const ordered = scopeStages(stages, now)
  const rank = new Map(ordered.map((stage, index) => [stage.id, index]))
  const titleOf = new Map(ordered.map(stage => [stage.id, stage.title]))
  const inScopeIds = new Set(ordered.map(stage => stage.id))
  // 全部阶段 id：用来区分「没归阶段 / 阶段被删了」和「挂在还没开始的阶段上」
  const allStageIds = new Set(stages.map(stage => stage.id))
  const start = weekStart(now)
  const end = weekEnd(now)

  const rows: StalledRow[] = []
  let movedCount = 0
  let totalCount = 0

  achievements.forEach(item => {
    // 个人兴趣不进这一块：复盘催的是职业目标，自己的事不该每周被点名
    if (item.kind === 'life') return

    const stageId = item.stageId
    // 挂在将来阶段上的不算 —— 需求是「当前阶段及之前」
    if (stageId !== undefined && allStageIds.has(stageId) && !inScopeIds.has(stageId)) return
    // 没归阶段、或者阶段已经被删了：跟目标页一样落到「未归类」，照样算进来
    const isOrphan = stageId === undefined || !allStageIds.has(stageId)

    totalCount += 1
    const tasks = tasksOf(todos, item.id)
    const movedThisWeek = tasks.some(
      todo => typeof todo.doneAt === 'number' && todo.doneAt >= start && todo.doneAt < end,
    )
    if (movedThisWeek) movedCount += 1
    if (item.status === 'done' || movedThisWeek) return

    const last = lastDoneAt(tasks)
    rows.push({
      item,
      stageTitle: isOrphan ? '未归类' : (titleOf.get(item.stageId as number) ?? '未归类'),
      last,
      days: last === undefined ? undefined : daysSince(last, now),
    })
  })

  rows.sort((a, b) => {
    const ra = rank.get(a.item.stageId ?? -1) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(b.item.stageId ?? -1) ?? Number.MAX_SAFE_INTEGER
    if (ra !== rb) return ra - rb
    return a.item.id - b.item.id
  })

  return { rows, movedCount, totalCount, hasMilestones: totalCount > 0 }
}

/**
 * 这条里程碑上还有没有没做完的活 —— 复盘里那颗按钮据此变成「已加入下周」。
 *
 * 认 achievementId 也认 goalId：「下周做它」生成的任务是软关联（写在 goalId 上，
 * 这样它才出现在首页和计划里），只认 achievementId 的话按钮永远点得动。
 *
 * 反过来说，任务被勾掉或删掉之后按钮会自己退回「下周做它」——
 * 那说明下周又空出来了，可以再排一件。
 */
export function hasOpenPlan(todos: Todo[], achievementId: number): boolean {
  return todos.some(
    todo =>
      !todo.done && (todo.achievementId === achievementId || todo.goalId === achievementId),
  )
}

/* ---------- 下周 ---------- */

/**
 * 「下周做它」默认的截止日期 = 下周日。
 *
 * 下周 = [下周一, 下下周一)，所以用本周周一 + 7 天再 + 6 天。
 * 今天正好是周日时这也是 7 天后，不会落在今天。
 */
export function nextWeekSundayKey(now: number = Date.now()): string {
  const nextMonday = new Date(weekEnd(now))
  return dayKey(
    new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate() + 6).getTime(),
  )
}

/** 本周一的日期键，页面渲染和保存都拿它当那一周的 id */
export function thisWeekKey(now: number = Date.now()): string {
  return weekKeyOf(now)
}
