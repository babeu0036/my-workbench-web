import { useEffect, useRef, useState } from 'react'
import AddTaskPanel from './AddTaskPanel'
import ConfirmDelete from './ConfirmDelete'
import TaskInput from './TaskInput'
import TaskList from './TaskList'
import { WHY_MAX } from '../lib/achievements'
import { dayKey, formatDateCn } from '../lib/date'
import { MILESTONE_SHORT_MAX, milestoneState, shortOf, statsOf } from '../lib/milestones'
import type { MilestoneState } from '../lib/milestones'
import { isHttpUrl, middleEllipsis } from '../lib/text'
import type { Achievement, MilestoneKind, Todo } from '../lib/types'

/** 卡片上点一下就能就地改的几行 */
type FieldKey = 'short' | 'criteria' | 'why' | 'evidence'

type Props = {
  achievement: Achievement
  /** 这条阶段目标下的任务（硬关联 + 软关联都算），外部已经按创建时间排好 */
  tasks: Todo[]
  /** 它挂在哪个阶段下：点任务编辑时用来说清「属于哪个阶段目标、哪个阶段」 */
  stageTitle?: string
  onToggleTask: (id: number) => void
  onRemoveTask: (id: number) => void
  onAddTask: (text: string, dueDate: string) => void
  /** 改文字和日期。阶段目标任务的科目和类型不给改，所以只收这两项 */
  onEditTask: (id: number, text: string, dueDate: string) => void
  /** 改短名 / 判断标准 / 留下什么 / 证据 / 类型 */
  onUpdate: (patch: {
    short?: string
    criteria?: string
    why?: string
    evidence?: string
    kind?: MilestoneKind
  }) => void
  /** 写够证据以后才能点这里 */
  onComplete: () => void
  onReopen: () => void
  /** 删除这条阶段目标（任务会退回未分类，不跟着删） */
  onRemove: () => void
}

const STATE_LABEL: Record<MilestoneState, string> = {
  empty: '未开始',
  doing: '进行中',
  confirm: '待确认',
  done: '已完成',
}

/**
 * 一张阶段目标卡，状态由 `milestoneState` 从关联任务算出来：
 *
 * - 未开始：还没有任务，标题下面那行写「还没有任务」，不显示 0%；
 * - 进行中 / 待确认：标题下面直接是「x/y 条任务已完成」+ 进度条，任务列表缩进排在下面；
 * - 已完成：任务全勾完、而且写了证据、手动确认过。
 *
 * 简称、判断标准、留下什么、证据都是点一下就地改（回车保存、Esc 放弃、失焦也算保存）；
 * 职业相关 / 个人兴趣是两选一，点一下直接切。
 * 简称留空就跟着标题走：自动取前 4 个字加省略号，任务行的小标签显示的就是它。
 *
 * 「标记完成」会先弹出证据输入框 —— 证据为空时那个「确定完成」是禁用的，
 * 下面写着为什么。不让人在没证据的情况下把阶段目标点绿。
 */
export default function AchievementCard({
  achievement,
  tasks,
  stageTitle,
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
  const [field, setField] = useState<FieldKey | null>(null)
  const [draft, setDraft] = useState('')
  // 「标记完成」弹出来的那层：草稿预填现有证据，通常本来就是空的
  const [confirming, setConfirming] = useState(false)
  const [evidenceDraft, setEvidenceDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const fieldRef = useRef<HTMLInputElement>(null)
  const evidenceRef = useRef<HTMLInputElement>(null)

  const state = milestoneState(achievement, tasks)
  const stats = statsOf(tasks)
  const autoShort = shortOf(achievement)

  useEffect(() => {
    if (field) fieldRef.current?.focus()
  }, [field])

  useEffect(() => {
    if (confirming) evidenceRef.current?.focus()
  }, [confirming])

  function startAdd() {
    setAdding(true)
    // 等输入条挂上去再把焦点放进去，少点一次
    window.setTimeout(() => inputRef.current?.focus(), 20)
  }

  function startEdit(next: FieldKey) {
    setField(next)
    // 简称的草稿只认手填的那个值：留空 = 继续跟着标题自动走
    setDraft(next === 'short' ? (achievement.short ?? '') : achievement[next])
  }

  function commit() {
    if (!field) return
    onUpdate({ [field]: draft } as {
      short?: string
      criteria?: string
      why?: string
      evidence?: string
    })
    setField(null)
  }

  function openConfirm() {
    setEvidenceDraft(achievement.evidence)
    setConfirming(true)
  }

  function submitComplete() {
    const evidence = evidenceDraft.trim()
    if (!evidence) return
    // 先写证据再置完成：两个都是函数式更新，按顺序排队，
    // 第二条看到的就是刚写进去的证据（markAchievementDone 那边会再校验一次）
    onUpdate({ evidence })
    onComplete()
    setConfirming(false)
  }

  /** 三行共用同一种输入行：一行字，回车保存，失焦也保存 */
  const fieldRow = (key: FieldKey, label: string, placeholder: string) => {
    const value = key === 'short' ? (achievement.short ?? '') : achievement[key]
    // 简称没填时显示的是自动截出来的那个，不然这一行会空着、看不出标签长什么样
    const shown = key === 'short' ? autoShort : value

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
            maxLength={
              key === 'short' ? MILESTONE_SHORT_MAX : key === 'why' ? WHY_MAX : 200
            }
            placeholder={
              key === 'short' ? `留空自动取「${autoShort}」，最多 ${MILESTONE_SHORT_MAX} 个字` : placeholder
            }
          />
        </div>
      )
    }

    // 证据是网址就渲染成链接：点开是新窗口，文字中间省略，全名放在 title 里
    if (key === 'evidence' && isHttpUrl(shown)) {
      return (
        <div className="ach__field ach__field--link">
          <span className="ach__field-key">{label}</span>
          <a
            className="ach__link"
            href={shown}
            target="_blank"
            rel="noopener noreferrer"
            title={shown}
          >
            {middleEllipsis(shown, 24, 12)}
          </a>
          <button
            type="button"
            className="ach__field-edit"
            onClick={() => startEdit(key)}
            aria-label={`修改${label}`}
          >
            改
          </button>
        </div>
      )
    }

    return (
      <button type="button" className="ach__field" onClick={() => startEdit(key)}>
        <span className="ach__field-key">{label}</span>
        <span className={shown ? 'ach__field-val' : 'ach__field-val ach__field-val--empty'}>
          {shown || placeholder}
        </span>
      </button>
    )
  }

  return (
    <article className={`card ach ach--${state}`} aria-label={`阶段目标：${achievement.title}`}>
      <div className="ach__head">
        <span className="ach__title">{achievement.title}</span>
        <span className={`ach__badge ach__badge--${state}`}>{STATE_LABEL[state]}</span>
        <ConfirmDelete className="ach__remove" label="删除" onConfirm={onRemove} />
      </div>

      {/* 标题下面第一行就说清这个目标下有多少活：x/y 条任务已完成 */}
      <div className="ach__progress">
        <span className="ach__count">
          {stats.total === 0 ? '还没有任务' : `${stats.done}/${stats.total} 条任务已完成`}
        </span>
        {stats.total > 0 && (
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
        )}
      </div>

      {fieldRow('short', '简称', '')}
      {fieldRow('criteria', '判断标准', '做到什么程度算成')}
      {/* 两选一：不做成文本行，点一下直接切，切换不留校验也不影响完成 */}
      <div className="ach__kind">
        <span className="ach__field-key">类型</span>
        {(['work', 'life'] as MilestoneKind[]).map(value => {
          const on = (achievement.kind ?? 'work') === value
          return (
            <button
              key={value}
              type="button"
              className={on ? 'ach__kind-pill ach__kind-pill--on' : 'ach__kind-pill'}
              onClick={() => onUpdate({ kind: value })}
              aria-pressed={on}
            >
              {value === 'work' ? '职业相关' : '个人兴趣'}
            </button>
          )
        })}
      </div>

      {fieldRow('why', '留下什么', '做完这个，我手里会多出什么（可留空）')}
      {fieldRow('evidence', '证据', '怎么证明做到了')}

      {state === 'done' && achievement.doneAt !== undefined && (
        <p className="ach__lit">
          <span className="ach__dot" aria-hidden="true" />
          {formatDateCn(dayKey(achievement.doneAt))} 确认完成
        </p>
      )}

      {/* 任务缩进排在这张卡下面：左侧一条竖线 + 每行一个圆点，
          一眼看出它们是「这个阶段目标」的，不是另一份平铺清单 */}
      {tasks.length > 0 && (
        <TaskList
          todos={tasks}
          empty=""
          nested
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
          {/* 先弹证据框，证据空着就确定不了 —— 门槛在弹窗里，不在这颗按钮上 */}
          <button type="button" className="btn btn--primary ach__done" onClick={openConfirm}>
            标记完成
          </button>
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
          给这个目标加任务
        </button>
      ) : (
        <button type="button" className="ach__add" onClick={startAdd}>
          + 给这个目标加任务
        </button>
      )}

      {/* 编辑的是阶段目标任务：科目和类型都锁住，只改文字和日期；
          顶部那行「属于」是需求里的「点一条任务就知道它在哪一层」 */}
      {editing && (
        <AddTaskPanel
          subjects={[]}
          todo={editing}
          owner={{ stage: stageTitle ?? '未归类', goal: achievement.title }}
          onClose={() => setEditing(null)}
          onSubmit={(text, _subjectId, dueDate) => {
            onEditTask(editing.id, text, dueDate)
            setEditing(null)
          }}
        />
      )}

      {/* 标记完成：先让写证据，写不出就不让点确定 */}
      {confirming && (
        <div className="sheet-layer">
          <div className="sheet-mask" onClick={() => setConfirming(false)} aria-hidden="true" />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="标记完成">
            <div className="sheet__head">
              <span className="sheet__title">标记完成</span>
              <button
                type="button"
                className="sheet__close"
                onClick={() => setConfirming(false)}
                aria-label="收起"
              >
                ×
              </button>
            </div>

            <p className="sheet__hint">「{achievement.title}」怎么证明做到了？留一句再确认。</p>

            <input
              ref={evidenceRef}
              className="input"
              value={evidenceDraft}
              onChange={event => setEvidenceDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') submitComplete()
                if (event.key === 'Escape') setConfirming(false)
              }}
              placeholder="链接、结果、截图说明都行"
              aria-label="证据"
              maxLength={200}
            />

            {!evidenceDraft.trim() && (
              <p className="sheet__hint">完成一个阶段目标，得留下证据</p>
            )}

            <button
              type="button"
              className="btn btn--primary sheet__submit"
              onClick={submitComplete}
              disabled={!evidenceDraft.trim()}
            >
              确定完成
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
