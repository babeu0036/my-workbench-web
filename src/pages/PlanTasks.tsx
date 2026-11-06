import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AddTaskPanel from '../components/AddTaskPanel'
import TaskList from '../components/TaskList'
import { KEYS, useStoredState } from '../lib/storage'
import {
  UNCATEGORIZED_ID,
  addTodo,
  byFilter,
  removeTodo,
  sortForPlan,
  toggleTodo,
  updateTodo,
} from '../lib/todos'
import type { TaskFilter } from '../lib/todos'
import type { Subject, Todo, TodoKind } from '../lib/types'

/** label 是胶囊上的字（长科目用短名），full 是空状态里说人话用的全名 */
type Filter = { key: TaskFilter; label: string; full: string }

type Props = {
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  subjects: Subject[]
}

/**
 * 计划 · 任务。这里是**全部任务**，不再只收本周的（原来走 weekTasks）：
 * 跨周的、逾期的、没日期的、早就做完的都在，靠排序和「隐藏已完成」收拾。
 *
 * 排序见 lib/todos.ts 的 sortForPlan：截止日期从近到远，没日期的排最后，
 * 已完成一律沉底。筛选按科目走：全部 / 各科目 / 琐事，有未分类的学习任务时
 * 才多挂一项。统计行上的数字跟着当前筛选走，和下面的列表永远对得上。
 *
 * 右下角的 + 复用首页那个添加面板，加进来的任务和首页加的完全一样。
 */
export default function PlanTasks({ todos, setTodos, subjects }: Props) {
  const [filter, setFilter] = useState<TaskFilter>('all')
  // 只影响这一屏画不画已完成的，不删数据、也不落盘：刷新回到默认的「显示」
  const [hideDone, setHideDone] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  // 正在编辑的那条：存整条快照，面板关掉就清空
  const [editing, setEditing] = useState<Todo | null>(null)
  // 和首页共用同一个 key：在哪儿加过英语，下次打开面板都站在英语上
  const [lastSubjectId, setLastSubjectId] = useStoredState<string>(KEYS.lastSubject, '')

  const pickable = subjects.filter(subject => subject.id !== UNCATEGORIZED_ID)
  const defaultSubjectId = pickable.some(subject => subject.id === lastSubjectId)
    ? lastSubjectId
    : ''

  // 有未分类的学习任务才挂那一项：没有的话点进去必然是空列表
  const hasUnclassified = todos.some(todo => !todo.subjectId && todo.kind !== 'chore')
  const filters: Filter[] = [
    { key: 'all', label: '全部', full: '全部' },
    // 胶囊位置紧张：「计算机程序设计」在 360px 下会把一排顶成三行，用 short 顶上
    ...pickable.map(subject => ({
      key: subject.id,
      label: subject.short ?? subject.name,
      full: subject.name,
    })),
    { key: 'chore', label: '琐事', full: '琐事' },
    ...(hasUnclassified ? [{ key: 'none', label: '未分类', full: '未分类的任务' }] : []),
  ]

  const filtered = byFilter(todos, filter)
  // 总数和完成数按筛选后的全量算，隐藏已完成只影响画出来的那几条
  const total = filtered.length
  const doneCount = filtered.filter(todo => todo.done).length
  const shown = sortForPlan(hideDone ? filtered.filter(todo => !todo.done) : filtered)

  const active = filters.find(item => item.key === filter) ?? filters[0]
  // 藏起来以后空了，别让人以为任务被删了 —— 空状态得说清是开关干的
  const empty =
    hideDone && total > 0
      ? '这个筛选下的都做完了，关掉「隐藏已完成」能看见'
      : filter === 'all'
        ? '还没有任务，点右下角的 + 加一条'
        : filter === 'chore'
          ? '还没有琐事'
          : filter === 'none'
            ? '没有未分类的学习任务'
            : `还没有${active.full}的任务`

  function handleAdd(text: string, subjectId: string, dueDate: string, kind: TodoKind) {
    setTodos(list => addTodo(list, text, subjectId, dueDate, kind))
    if (kind === 'study') setLastSubjectId(subjectId)
    setPanelOpen(false)
  }

  return (
    <>
      <div className="page page--fab">
        <p className="page__hint">按截止日期排序 · 没日期的排在后面 · 已完成沉底</p>

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

        <div className="tasks__bar">
          <p className="tasks__count">
            共 <b>{total}</b> 条
            {doneCount > 0 && (
              <>
                ，已完成 <b>{doneCount}</b> 条
              </>
            )}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={hideDone}
            className={hideDone ? 'switch switch--on' : 'switch'}
            onClick={() => setHideDone(value => !value)}
          >
            <span className="switch__track" aria-hidden="true">
              <span className="switch__knob" />
            </span>
            隐藏已完成
          </button>
        </div>

        <TaskList
          todos={shown}
          empty={empty}
          onToggle={id => setTodos(list => toggleTodo(list, id))}
          onRemove={id => setTodos(list => removeTodo(list, id))}
          onEdit={id => setEditing(todos.find(todo => todo.id === id) ?? null)}
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
          onSubmit={handleAdd}
        />
      )}

      {editing && (
        <AddTaskPanel
          subjects={pickable}
          todo={editing}
          onClose={() => setEditing(null)}
          onSubmit={(text, subjectId, dueDate, kind) => {
            setTodos(list => updateTodo(list, editing.id, { text, subjectId, dueDate, kind }))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
