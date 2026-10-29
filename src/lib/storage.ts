import { useEffect, useState } from 'react'
import type { Todo } from './types'

/** localStorage 的两个 key，分开存，互不影响 */
export const KEYS = {
  todos: 'workbench.todos',
  deadlines: 'workbench.deadlines',
  notes: 'workbench.notes',
} as const

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
  } catch {
    // 隐私模式 / 空间不足：忽略即可，页面照常可用
  }
}

/**
 * 跟 useState 一样用，但会自动跟 localStorage 同步：
 * 初始值从本地读，之后每次变化自动写回。
 */
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readKey(key, initial))

  useEffect(() => {
    writeKey(key, value)
  }, [key, value])

  return [value, setValue] as const
}

/**
 * 老版本的待办存在 'todos' 里，这里搬到 'workbench.todos'，
 * 保证改造前加的待办不会丢。老 key 保留不删。
 */
export function migrateLegacyStorage(): void {
  const legacy = readKey<Todo[] | null>('todos', null)
  if (!legacy || !Array.isArray(legacy)) return

  // 已经有新数据了就以新数据为准
  if (readKey<Todo[] | null>(KEYS.todos, null) !== null) return

  writeKey(
    KEYS.todos,
    legacy.map(t => ({ id: t.id, text: t.text, done: Boolean(t.done) })),
  )
}
