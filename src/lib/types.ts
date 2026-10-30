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

export type TabKey = 'today' | 'plan' | 'focus' | 'profile'
