import type { Deadline, Note, Todo } from '../lib/types'

type Props = {
  todos: Todo[]
  deadlines: Deadline[]
  notes: Note[]
}

/** 第一步先占位，把三组数据接住；下一步换成待办/比赛/笔记三个分段 */
export default function Plan({ todos, deadlines, notes }: Props) {
  const pending = todos.filter(t => !t.done).length

  return (
    <div className="page">
      <h2 className="page__title">计划</h2>
      <p className="page__hint">
        待办 {pending} 条待完成 · 比赛 {deadlines.length} 场 · 笔记 {notes.length} 条
      </p>
      <p className="meta">占位页：下一步把这三块合并成三个分段。</p>
    </div>
  )
}
