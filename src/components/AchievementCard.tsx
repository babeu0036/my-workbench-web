import { useRef, useState } from 'react'
import AddTaskPanel from './AddTaskPanel'
import ConfirmDelete from './ConfirmDelete'
import TaskInput from './TaskInput'
import TaskList from './TaskList'
import { achievementState, statsOf } from '../lib/achievements'
import { dayKey, formatDateCn } from '../lib/date'
import type { Achievement, Todo } from '../lib/types'

type Props = {
  achievement: Achievement
  /** 这条成就下的任务，外部已经按创建时间排好 */
  tasks: Todo[]
  onToggleTask: (id: number) => void
  onRemoveTask: (id: number) => void
  onAddTask: (text: string, dueDate: string) => void
  /** 改文字和日期。成就任务的科目和类型不给改，所以只收这两项 */
  onEditTask: (id: number, text: string, dueDate: string) => void
  /** 删除这条成就（任务会退回未分类，不跟着删） */
  onRemove: () => void
}

const STATE_LABEL = {
  empty: '未开始',
  running: '进行中',
  lit: '已点亮',
} as const

/**
 * 一张成就卡，三种状态都由 `achievementState` 算出来：
 *
 * - 未开始：没有任务，一句「还没有任务，点这里添加」，点了就地展开输入条；
 * - 进行中：完成 x / y 条 + 进度条 + 任务列表，可以直接勾；
 * - 已点亮：任务全部勾完，标题旁挂绿标和达成日期。
 *
 * 点亮不是按钮，是任务勾完自动发生的（写入 doneAt 在 App 那一层统一做）。
 * 输入条默认收起：卡片多了以后每条都挂着日期选择器，页面会长得没法看；
 * 加完一条就自动收起，要连着加再点一次「加任务」。
 */
export default function AchievementCard({
  achievement,
  tasks,
  onToggleTask,
  onRemoveTask,
  onAddTask,
  onEditTask,
  onRemove,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const state = achievementState(achievement, tasks)
  const stats = statsOf(tasks)

  function startAdd() {
    setAdding(true)
    // 等输入条挂上去再把焦点放进去，少点一次
    window.setTimeout(() => inputRef.current?.focus(), 20)
  }

  return (
    <article className={`card ach ach--${state}`} aria-label={`成就：${achievement.title}`}>
      <div className="ach__head">
        <span className="ach__title">{achievement.title}</span>
        <span className={`ach__badge ach__badge--${state}`}>{STATE_LABEL[state]}</span>
        <ConfirmDelete className="ach__remove" label="删除" onConfirm={onRemove} />
      </div>

      {achievement.note && <p className="ach__note">{achievement.note}</p>}

      {state === 'lit' && achievement.doneAt !== undefined && (
        <p className="ach__lit">
          <span className="ach__dot" aria-hidden="true" />
          {formatDateCn(dayKey(achievement.doneAt))} 达成
        </p>
      )}

      {state !== 'empty' && (
        <>
          <div className="ach__progress">
            <div
              className="ach__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={stats.total}
              aria-valuenow={stats.done}
              aria-label="完成进度"
            >
              <span className="ach__bar-fill" style={{ width: `${stats.percent}%` }} />
            </div>
            <span className="ach__count">
              完成 {stats.done} / {stats.total} 条
            </span>
          </div>

          <TaskList
            todos={tasks}
            empty=""
            onToggle={onToggleTask}
            onRemove={onRemoveTask}
            onEdit={id => setEditing(tasks.find(todo => todo.id === id) ?? null)}
          />
        </>
      )}

      {adding ? (
        <TaskInput
          inputRef={inputRef}
          placeholder="加一件要做到的事…"
          label={`给「${achievement.title}」加任务`}
          optionalDate
          onAdd={(text, dueDate) => {
            onAddTask(text, dueDate)
            // 加完就收起，卡片回到三态的干净样子
            setAdding(false)
          }}
        />
      ) : state === 'empty' ? (
        <button type="button" className="ach__empty" onClick={startAdd}>
          还没有任务，点这里添加
        </button>
      ) : (
        <button type="button" className="ach__add" onClick={startAdd}>
          + 加任务
        </button>
      )}

      {/* 编辑的是成就任务：科目和类型都锁住，只改文字和日期 */}
      {editing && (
        <AddTaskPanel
          subjects={[]}
          todo={editing}
          onClose={() => setEditing(null)}
          onSubmit={(text, _subjectId, dueDate) => {
            onEditTask(editing.id, text, dueDate)
            setEditing(null)
          }}
        />
      )}
    </article>
  )
}
