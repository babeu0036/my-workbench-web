import { useEffect, useState } from 'react'
import { normalizeTodos } from './todos'
import type { Todo } from './types'

/** localStorage 的几个 key，分开存，互不影响 */
export const KEYS = {
  todos: 'workbench.todos',
  deadlines: 'workbench.deadlines',
  notes: 'workbench.notes',
  goals: 'workbench.goals',
  /** 首页添加面板上次选的科目，只有一个字符串 */
  lastSubject: 'workbench.lastSubject',
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
 * 老版本的待办存在 'todos' 里，这里搬到 'workbench.todos'，
 * 保证改造前加的待办不会丢。老 key 保留不删。
 */
export function migrateLegacyStorage(): void {
  const legacy = readKey<unknown>('todos', null)
  if (!Array.isArray(legacy)) return

  // 已经有新数据了就以新数据为准
  if (readKey<Todo[] | null>(KEYS.todos, null) !== null) return

  // 老数据没有 subjectId / createdAt，补齐后归到「未分类」
  writeKey(KEYS.todos, normalizeTodos(legacy))
}
