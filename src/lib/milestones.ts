import {
  UNSORTED_STAGE_ID,
  UNSORTED_STAGE_TITLE,
  sortStages,
} from './stages'
import type { Achievement, Stage, Todo } from './types'

/**
 * 里程碑的进度与状态。全部由「关联任务」算出来，不另存一份进度。
 *
 * 一条里程碑的任务有两个来源：
 * - `Todo.achievementId`：目标页上一条条加的任务（任务只活在目标页）；
 * - `Todo.goalId`：在首页 / 计划加任务时选了「服务于」（任务还在原处）。
 * 两边都要算进来，不然老的目标页任务会凭空消失、进度变 0。
 *
 * 状态四态（显示用）：
 * - empty：还没有任何任务 → 灰字「还没有行动」，不显示 0%；
 * - doing：有任务但没全完成；
 * - confirm：任务全完成了，但还没确认 → 显示「待确认」；
 * - done：人写了证据、手动点过「标记完成」。
 */

export type MilestoneState = 'empty' | 'doing' | 'confirm' | 'done'

/** 算进这条里程碑的任务，按创建时间从早到晚 */
export function tasksOf(todos: Todo[], id: number): Todo[] {
  return todos
    .filter(todo => todo.goalId === id || todo.achievementId === id)
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
}

export type MilestoneStats = {
  /** 已完成的任务数 */
  done: number
  /** 关联任务总数 */
  total: number
  /** 0-100 的整数。没有任务时给 0，但页面上不显示这个 0 */
  percent: number
}

export function statsOf(tasks: Todo[]): MilestoneStats {
  const done = tasks.filter(todo => todo.done).length
  const total = tasks.length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export function milestoneState(item: Achievement, tasks: Todo[]): MilestoneState {
  if (item.status === 'done') return 'done'
  if (tasks.length === 0) return 'empty'
  return tasks.every(todo => todo.done) ? 'confirm' : 'doing'
}

/** 最近一次完成任务的时间。一条都没完成过时 undefined，页面显示「—」 */
export function lastDoneAt(tasks: Todo[]): number | undefined {
  return tasks.reduce<number | undefined>((acc, todo) => {
    if (!todo.done || todo.doneAt === undefined) return acc
    return acc === undefined || todo.doneAt > acc ? todo.doneAt : acc
  }, undefined)
}

export type ActiveMilestone = {
  item: Achievement
  tasks: Todo[]
  stats: MilestoneStats
  /** 最近完成时间，没有就是 undefined */
  last: number | undefined
  state: MilestoneState
}

/**
 * 首页「进行中的里程碑」。
 *
 * 只收还没确认完成、而且**真的有任务**的 —— 一条空里程碑不叫在推进。
 * 传了 stageId 就只看这个阶段（首页按今天算出来的当前阶段）；
 * 排序：待确认的排最前（它们等着人动手），其余按最近完成时间倒序。
 */
export function activeMilestones(
  list: Achievement[],
  todos: Todo[],
  stageId?: number,
  limit = 3,
): ActiveMilestone[] {
  const scope =
    stageId === undefined
      ? list
      : list.filter(item => (item.stageId ?? UNSORTED_STAGE_ID) === stageId)

  const rows = scope
    .map(item => {
      const tasks = tasksOf(todos, item.id)
      return {
        item,
        tasks,
        stats: statsOf(tasks),
        last: lastDoneAt(tasks),
        state: milestoneState(item, tasks),
      }
    })
    .filter(row => row.state === 'doing' || row.state === 'confirm')

  rows.sort((a, b) => {
    if (a.state !== b.state) return a.state === 'confirm' ? -1 : 1
    const la = a.last ?? 0
    const lb = b.last ?? 0
    if (la !== lb) return lb - la
    return b.item.id - a.item.id
  })

  return rows.slice(0, limit)
}

/**
 * 「服务于」下拉里的选项：每条里程碑 + 它属于哪个阶段。
 * 按阶段先后排，没归阶段（或阶段已被删）的落最后，分组标题写「未归类」。
 */
export type MilestoneOption = {
  id: number
  title: string
  /** 所属阶段名，下拉里用它做分组标题 */
  stageTitle: string
  /** 阶段顺序，排序用 */
  order: number
}

export function milestoneOptions(list: Achievement[], stages: Stage[]): MilestoneOption[] {
  const ordered = sortStages(stages)
  const rank = new Map(ordered.map((stage, index) => [stage.id, index]))
  const titleOf = new Map(ordered.map(stage => [stage.id, stage.title]))

  return list
    .map(item => {
      const stageId = item.stageId ?? UNSORTED_STAGE_ID
      return {
        id: item.id,
        title: item.title,
        stageTitle: titleOf.get(stageId) ?? UNSORTED_STAGE_TITLE,
        order: rank.get(stageId) ?? ordered.length,
      }
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'zh'))
}
