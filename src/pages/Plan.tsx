import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import TodoPage from './Todo'
import Deadlines from './Deadlines'
import NotesPage from './Notes'
import type { Deadline, Note, Todo } from '../lib/types'

/** 三个分段的顺序，第一项也是默认打开的那段 */
const SEGMENTS = [
  { key: 'todo', label: '待办' },
  { key: 'deadlines', label: '比赛' },
  { key: 'notes', label: '笔记' },
] as const

type SegmentKey = (typeof SEGMENTS)[number]['key']

type Props = {
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  deadlines: Deadline[]
  setDeadlines: Dispatch<SetStateAction<Deadline[]>>
  notes: Note[]
  setNotes: Dispatch<SetStateAction<Note[]>>
}

/**
 * 计划页：待办 / 比赛 / 笔记合并成三个分段。
 * 三个子页面组件原样复用，只在此处透传数据；segment 留在组件内，
 * 切走 Tab 时卸载即重置回「待办」。
 */
export default function Plan({
  todos,
  setTodos,
  deadlines,
  setDeadlines,
  notes,
  setNotes,
}: Props) {
  const [segment, setSegment] = useState<SegmentKey>('todo')

  return (
    <div className="plan">
      <div className="seg" role="group" aria-label="计划分类">
        {SEGMENTS.map(seg => (
          <button
            key={seg.key}
            type="button"
            aria-pressed={seg.key === segment}
            className={seg.key === segment ? 'seg__btn seg__btn--active' : 'seg__btn'}
            onClick={() => setSegment(seg.key)}
          >
            {seg.label}
          </button>
        ))}
      </div>

      {segment === 'todo' && <TodoPage todos={todos} setTodos={setTodos} />}
      {segment === 'deadlines' && <Deadlines deadlines={deadlines} setDeadlines={setDeadlines} />}
      {segment === 'notes' && <NotesPage notes={notes} setNotes={setNotes} />}
    </div>
  )
}
