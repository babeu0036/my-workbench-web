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

export type TabKey = 'home' | 'todo' | 'deadlines'
