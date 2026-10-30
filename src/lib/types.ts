export type Todo = {
  id: number
  text: string
  done: boolean
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
