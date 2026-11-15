import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AddTaskPanel from '../components/AddTaskPanel'
import TaskInput from '../components/TaskInput'
import TaskList from '../components/TaskList'
import {
  UNCATEGORIZED_ID,
  addTodo,
  forSubject,
  removeTodo,
  toggleTodo,
  updateTodo,
  weekStats,
} from '../lib/todos'
import type { MilestoneOption } from '../lib/milestones'
import type { Subject, Todo } from '../lib/types'

type Props = {
  subject: Subject | undefined
  /** 编辑任务时面板要列全部真科目：这条本来是英语的，也能改成高数 */
  subjects: Subject[]
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  /** 「服务于」的选项：行右侧的小标签和编辑面板共用 */
  milestones: MilestoneOption[]
}

/**
 * 科目详情。英语 / 高数 / C语言 共用这一个组件，靠 id 区分；
 * id 为空的「未分类」也走这一页，逻辑完全一样。
 * 只有任务一件事 —— 原来那个「任务 / 错题」分段已经删了，不再留错题这一层。
 */
export default function SubjectPage({
  subject,
  subjects,
  todos,
  setTodos,
  milestones,
}: Props) {
  const [editing, setEditing] = useState<Todo | null>(null)

  if (!subject) {
    return (
      <div className="page">
        <h2 className="page__title">科目</h2>
        <p className="page__hint">这个科目不存在，可能数据被改过。</p>
      </div>
    )
  }

  const mine = forSubject(todos, subject.id)
  // 未分类不是一个可选科目，编辑面板里不能选它
  const pickable = subjects.filter(item => item.id !== UNCATEGORIZED_ID)
  const stat = weekStats(todos, subject.id)
  // 「未分类」直接念科目名会读成「写一件未分类要做的事」，单独说人话
  const isUnclassified = subject.id === UNCATEGORIZED_ID

  return (
    <div className="page">
      <header className="subject__head">
        <h2 className="subject__name">{subject.name}</h2>
        <span className="subject__stat">
          {stat.total > 0 ? `本周完成 ${stat.done}/${stat.total} 件` : '本周还没有任务'}
        </span>
      </header>

      <TaskList
        todos={mine}
        empty={`${subject.name}还没有任务，在下面加一条`}
        milestones={milestones}
        onToggle={id => setTodos(list => toggleTodo(list, id))}
        onRemove={id => setTodos(list => removeTodo(list, id))}
        onEdit={id => setEditing(todos.find(todo => todo.id === id) ?? null)}
      />

      <TaskInput
        placeholder={isUnclassified ? '写一件要做的事…' : `写一件${subject.name}要做的事…`}
        label={`添加${subject.name}任务`}
        onAdd={(text, dueDate) =>
          setTodos(list => addTodo(list, text, subject.id, dueDate, 'study'))
        }
      />

      {editing && (
        <AddTaskPanel
          subjects={pickable}
          todo={editing}
          milestones={milestones}
          onClose={() => setEditing(null)}
          onSubmit={(text, subjectId, dueDate, kind, goalId) => {
            setTodos(list =>
              updateTodo(list, editing.id, { text, subjectId, dueDate, kind, goalId: goalId ?? null }),
            )
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
