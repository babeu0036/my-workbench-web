import type { Subject } from './types'

/**
 * 初始科目。id 用固定字符串而不是 Date.now()：
 * 一是稳定（刷新不会变），二是以后数据导出再导入时能对上。
 * 这一版不做增删科目的界面，但数据是数组，加科目只是往这里再补一条。
 *
 * 改名不动 id：'clang' 从「C语言」改成「计算机程序设计」以后，
 * 老任务、老课程表里的 subjectId 一个字都不用迁，刷新就显示新名字。
 *
 * short 只给长名字的科目，用在计划页的筛选胶囊上（那里位置紧张）；
 * 科目页标题、添加面板的胶囊仍然显示全名。
 */
export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'english', name: '英语' },
  { id: 'math', name: '高数' },
  { id: 'clang', name: '计算机程序设计', short: '计算机' },
  { id: 'ai', name: '人工智能基础B', short: '人工智能' },
]
