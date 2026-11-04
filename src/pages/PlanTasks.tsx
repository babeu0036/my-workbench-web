import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AddTaskPanel from '../components/AddTaskPanel'
import TaskList from '../components/TaskList'
import { formatWeekRange, weekKeyOf } from '../lib/date'
import { KEYS, useStoredState } from '../lib/storage'
import {
  UNCATEGORIZED_ID,
  addTodo,
  byFilter,
  removeTodo,
  sortForPlan,
  toggleTodo,
  weekTasks,
} from '../lib/todos'
import type { TaskFilter } from '../lib/todos'
import type { Subject, Todo, TodoKind } from '../lib/types'

type Filter = { key: TaskFilter; label: string }

type Props = {
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  subjects: Subject[]
}

/**
 * 计划 · 任务。这周要处理的事都在这儿（口径见 lib/todos.ts 的 weekTasks）：
 * 本周截止的、逾期没做的、没设日期的待办、本周做完的。
 *
 * 列表按截止日期从近到远，没日期的排最后，已完成沉底。
 * 筛选按科目走：全部 / 三个科目 / 琐事，有未分类的学习任务时才多挂一项。
 * 右下角的 + 复用首页那个添加面板，加进来的任务和首页加的完全一样。
 */
export default function PlanTasks({ todos, setTodos, subjects }: Props) {
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [panelOpen, setPanelOpen] = useState(false)
  // 和首页共用同一个 key：在哪儿加过英语，下次打开面板都站在英语上
  const [lastSubjectId, setLastSubjectId] = useStoredState<string>(KEYS.lastSubject, '')

  const pickable = subjects.filter(subject => subject.id !== UNCATEGORIZED_ID)
  const defaultSubjectId = pickable.some(subject => subject.id === lastSubjectId)
    ? lastSubjectId
    : ''

  const week = weekTasks(todos)
  // 有未分类的学习任务才挂那一项：没有的话点进去必然是空列表
  const hasUnclassified = week.some(todo => !todo.subjectId && todo.kind !== 'chore')
  const filters: Filter[] = [
    { key: 'all', label: '全部' },
    ...pickable.map(subject => ({ key: subject.id, label: subject.name })),
    { key: 'chore', label: '琐事' },
    ...(hasUnclassified ? [{ key: 'none', label: '未分类' }] : []),
  ]

  const shown = sortForPlan(byFilter(week, filter))
  const doneCount = week.filter(todo => todo.done).length

  // 空状态跟着筛选项说人话：切到英语还说「这周还没有任务」就太笼统了
  const activeLabel = filters.find(item => item.key === filter)?.label ?? '全部'
  const empty =
    filter === 'all'
      ? '这周还没有任务，点右下角的 + 加一条'
      : filter === 'chore'
        ? '这周没有琐事'
        : filter === 'none'
          ? '没有未分类的学习任务'
          : `这周没有${activeLabel}的任务`

  function handleAdd(text: string, subjectId: string, dueDate: string, kind: TodoKind) {
    setTodos(list => addTodo(list, text, subjectId, dueDate, kind))
    if (kind === 'study') setLastSubjectId(subjectId)
    setPanelOpen(false)
  }

  return (
    <>
      <div className="page page--fab">
        <p className="page__hint">
          本周 {formatWeekRange(weekKeyOf())} · 共 {week.length} 条，已完成 {doneCount} 条
        </p>

        <div className="seg seg--wrap" role="group" aria-label="按科目筛选任务">
          {filters.map(item => (
            <button
              key={item.key}
              type="button"
              aria-pressed={item.key === filter}
              className={item.key === filter ? 'seg__btn seg__btn--active' : 'seg__btn'}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <TaskList
          todos={shown}
          empty={empty}
          onToggle={id => setTodos(list => toggleTodo(list, id))}
          onRemove={id => setTodos(list => removeTodo(list, id))}
        />
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
