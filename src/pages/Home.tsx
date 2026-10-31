import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AddTaskPanel from '../components/AddTaskPanel'
import DueSoon from '../components/DueSoon'
import TaskList from '../components/TaskList'
import { todayLabel } from '../lib/date'
import { KEYS, useStoredState } from '../lib/storage'
import { UNCATEGORIZED_ID, addTodo, clearDone, removeTodo, toggleTodo } from '../lib/todos'
import type { Subject, Todo } from '../lib/types'

type Props = {
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  subjects: Subject[]
  /** 该提醒的任务，最急的在前；在 App 里算好传进来，侧边栏角标用的是同一份 */
  dueItems: Todo[]
  onOpenSubject: (subjectId: string) => void
}

/**
 * 首页 = 今日任务。
 * 输入框不常驻了，改成右下角的 + 打开添加面板 —— 加任务时必须选科目和截止日期，
 * 这样新任务不会再产生「未分类」，也不会漏提醒
 * （老数据里的未分类照常显示，不隐藏）。
 */
export default function Home({ todos, setTodos, subjects, dueItems, onOpenSubject }: Props) {
  const [panelOpen, setPanelOpen] = useState(false)
  // 记住上次选的科目，下次打开面板直接站在那个科目上
  const [lastSubjectId, setLastSubjectId] = useStoredState<string>(KEYS.lastSubject, '')

  // 面板里只列真科目；未分类是历史数据的归宿，不是可选项
  const pickable = subjects.filter(subject => subject.id !== UNCATEGORIZED_ID)
  const defaultSubjectId = pickable.some(subject => subject.id === lastSubjectId)
    ? lastSubjectId
    : ''

  const doneCount = todos.filter(todo => todo.done).length

  function handleAdd(text: string, subjectId: string, dueDate: string) {
    setTodos(list => addTodo(list, text, subjectId, dueDate))
    setLastSubjectId(subjectId)
    setPanelOpen(false)
  }

  return (
    <>
      <div className="page page--fab">
        <h2 className="page__title">首页</h2>
        <p className="page__hint">{todayLabel()} · 今天的任务</p>

        <DueSoon items={dueItems} subjects={subjects} onOpenSubject={onOpenSubject} />

        <TaskList
          todos={todos}
          empty="今天还没有任务，点右下角的 + 加一条"
          onToggle={id => setTodos(list => toggleTodo(list, id))}
          onRemove={id => setTodos(list => removeTodo(list, id))}
        />

        {todos.length > 0 && (
          <div className="footer-bar">
            <span className="meta">
              共 {todos.length} 条，已完成 {doneCount} 条
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setTodos(list => clearDone(list))}
              disabled={doneCount === 0}
            >
              清空已完成
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="fab"
        onClick={() => setPanelOpen(true)}
        aria-label="添加任务"
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {panelOpen && (
        <AddTaskPanel
          subjects={pickable}
          defaultSubjectId={defaultSubjectId}
          onClose={() => setPanelOpen(false)}
          onAdd={handleAdd}
        />
      )}
    </>
  )
}
