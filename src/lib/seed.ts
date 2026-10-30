import type { Subject } from './types'

/**
 * 三个初始科目。id 用固定字符串而不是 Date.now()：
 * 一是稳定（刷新不会变），二是以后数据导出再导入时能对上。
 * 这一版不做增删科目的界面，但数据是数组，加科目只是往这里再补一条。
 */
export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'english', name: '英语' },
  { id: 'math', name: '高数' },
  { id: 'clang', name: 'C语言' },
]
