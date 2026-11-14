import { useEffect, useRef, useState } from 'react'
import AddTaskPanel from './AddTaskPanel'
import ConfirmDelete from './ConfirmDelete'
import TaskInput from './TaskInput'
import TaskList from './TaskList'
import { hasEvidence } from '../lib/achievements'
import { dayKey, formatDateCn } from '../lib/date'
import { milestoneState, statsOf } from '../lib/milestones'
import type { MilestoneState } from '../lib/milestones'
import type { Achievement, Todo } from '../lib/types'

type Props = {
  achievement: Achievement
  /** 这条里程碑下的任务（硬关联 + 软关联都算），外部已经按创建时间排好 */
  tasks: Todo[]
  onToggleTask: (id: number) => void
  onRemoveTask: (id: number) => void
  onAddTask: (text: string, dueDate: string) => void
  /** 改文字和日期。成就任务的科目和类型不给改，所以只收这两项 */
  onEditTask: (id: number, text: string, dueDate: string) => void
  /** 改判断标准 / 证据 */
  onUpdate: (patch: { criteria?: string; evidence?: string }) => void
  /** 写够证据以后才能点这里 */
  onComplete: () => void
  onReopen: () => void
  /** 删除这条成就（任务会退回未分类，不跟着删） */
  onRemove: () => void
}

const STATE_LABEL: Record<MilestoneState, string> = {
  empty: '未开始',
  doing: '进行中',
  confirm: '待确认',
  done: '已完成',
}

/**
 * 一张里程碑卡，状态由 `milestoneState` 从关联任务算出来：
 *
 * - 未开始：还没有任务，进度那行是灰字「还没有行动」，不显示 0%；
 * - 进行中 / 待确认：完成 x / y + 进度条 + 任务列表，可以直接勾；
 * - 已完成：任务全勾完、而且写了证据、手动确认过。
 *
 * 判断标准和证据都是点一下就地改（回车保存、Esc 放弃、失焦也算保存）。
 * 「标记完成」在证据为空时是禁用的，旁边写着为什么 —— 免得一堆其实没做成
 * 的事自己变绿。
 */
export default function AchievementCard({
  achievement,
  tasks,
  onToggleTask,
  onRemoveTask,
  onAddTask,
  onEditTask,
  onUpdate,
  onComplete,
  onReopen,
  onRemove,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)
  const [field, setField] = useState<'criteria' | 'evidence' | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const fieldRef = useRef<HTMLInputElement>(null)

  const state = milestoneState(achievement, tasks)
  const stats = statsOf(tasks)
  const ready = hasEvidence(achievement)

  useEffect(() => {
    if (field) fieldRef.current?.focus()
  }, [field])

  function startAdd() {
    setAdding(true)
    // 等输入条挂上去再把焦点放进去，少点一次
    window.setTimeout(() => inputRef.current?.focus(), 20)
  }

  function startEdit(next: 'criteria' | 'evidence') {
    setField(next)
    setDraft(next === 'criteria' ? achievement.criteria : achievement.evidence)
  }

  function commit() {
    if (!field) return
    onUpdate({ [field]: draft } as { criteria?: string; evidence?: string })
    setField(null)
  }

  /** 标准和证据共用同一种输入行：一行字，回车保存，失焦也保存 */
  const fieldRow = (key: 'criteria' | 'evidence', label: string, placeholder: string) => {
    const value = key === 'criteria' ? achievement.criteria : achievement.evidence
    if (field === key) {
      return (
        <div className="ach__field ach__field--edit">
          <span className="ach__field-key">{label}</span>
          <input
            ref={fieldRef}
            className="input ach__field-input"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') setField(null)
            }}
            onBlur={commit}
            aria-label={label}
            maxLength={200}
            placeholder={placeholder}
          />
        </div>
      )
    }

    return (
      <button type="button" className="ach__field" onClick={() => startEdit(key)}>
        <span className="ach__field-key">{label}</span>
        <span className={value ? 'ach__field-val' : 'ach__field-val ach__field-val--empty'}>
          {value || placeholder}
        </span>
      </button>
    )
  }

  return (
    <article className={`card ach ach--${state}`} aria-label={`里程碑：${achievement.title}`}>
      <div className="ach__head">
        <span className="ach__title">{achievement.title}</span>
        <span className={`ach__badge ach__badge--${state}`}>{STATE_LABEL[state]}</span>
        <ConfirmDelete className="ach__remove" label="删除" onConfirm={onRemove} />
      </div>

      {fieldRow('criteria', '判断标准', '做到什么程度算成')}
      {fieldRow('evidence', '证据', '怎么证明做到了')}

      {state === 'done' && achievement.doneAt !== undefined && (
        <p className="ach__lit">
          <span className="ach__dot" aria-hidden="true" />
          {formatDateCn(dayKey(achievement.doneAt))} 确认完成
        </p>
      )}

      {/* 一条任务都没有就只写「还没有行动」：0/0 和 0% 看着像「已经落后」 */}
      {stats.total === 0 ? (
        <p className="ach__none">还没有行动</p>
      ) : (
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
            {stats.done}/{stats.total}
          </span>
        </div>
      )}

      {tasks.length > 0 && (
        <TaskList
          todos={tasks}
          empty=""
          onToggle={onToggleTask}
          onRemove={onRemoveTask}
          onEdit={id => setEditing(tasks.find(todo => todo.id === id) ?? null)}
        />
      )}

      {state === 'done' ? (
        <button type="button" className="btn btn--ghost ach__reopen" onClick={onReopen}>
          撤销完成
        </button>
      ) : (
        <div className="ach__foot">
          <button
            type="button"
            className="btn btn--primary ach__done"
            onClick={onComplete}
            disabled={!ready}
          >
            标记完成
          </button>
          {!ready && <span className="ach__hint">完成一个里程碑，得留下证据</span>}
        </div>
      )}

      {adding ? (
        <TaskInput
          inputRef={inputRef}
          placeholder="加一件要做到的事…"
          label={`给「${achievement.title}」加任务`}
          optionalDate
          onAdd={(text, dueDate) => {
            onAddTask(text, dueDate)
            // 加完就收起，卡片回到干净的样子
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
