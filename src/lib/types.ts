export type Todo = {
  id: number
  text: string
  done: boolean
  /** 属于哪个科目；空字符串 = 未分类（老数据全落在这里） */
  subjectId: string
  /** 创建时间戳。老数据没有这个字段，迁移时拿它原来的 id 顶上 */
  createdAt: number
  /** 完成时间戳。没完成时没有，撤销完成时要清掉 */
  doneAt?: number
  /**
   * 截止日期，形如 2026-11-03（本地日期，不是时间戳）。
   * 新任务必填；改造前的老任务没有这一项，就不提醒，也不编一个假日期出来。
   */
  dueDate?: string
}

export type Deadline = {
  id: number
  name: string
  /** 形如 2026-11-01 */
  date: string
}

export type Note = {
  id: number
  content: string
  /** 最近一次保存的时间戳，输入过程中不变 */
  updatedAt: number
}

export type Subject = {
  id: string
  name: string
}

/**
 * 一周一条目标。
 * weekKey 用当周周一的日期字符串（如 2026-10-26），字符串比较就是时间先后。
 */
export type Goal = {
  id: number
  weekKey: string
  text: string
  /** 目标有没有达成；没结算前没有意义 */
  done: boolean
  /** 有没有结算过。结算后不再改动，是这一周的历史记录 */
  settled: boolean
}

export type PlanSegment = 'week' | 'deadlines'
export type SubjectSegment = 'tasks' | 'mistakes'
export type ReviewBlock = 'data' | 'goal'

/** 侧边栏能去的地方，一个对象就是当前所在位置 */
export type Route =
  | { page: 'home' }
  | { page: 'plan'; seg: PlanSegment }
  | { page: 'subject'; id: string; seg: SubjectSegment }
  | { page: 'review'; block: ReviewBlock }
  | { page: 'settings' }
