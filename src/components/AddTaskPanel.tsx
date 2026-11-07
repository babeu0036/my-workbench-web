import { useEffect, useRef, useState } from 'react'
import DuePicker from './DuePicker'
import { dayKey } from '../lib/date'
import type { Subject, Todo, TodoKind } from '../lib/types'

type Props = {
  /** 只放真科目，未分类不在里面 —— 这个面板不允许产生未分类的学习任务 */
  subjects: Subject[]
  /** 新增时的默认科目；编辑别的任务时用不到 */
  defaultSubjectId?: string
  /** 有值 = 编辑这条任务：字段预填，标题和按钮换字 */
  todo?: Todo
  onClose: () => void
  /** 新增和编辑共用：父层拿到这四个值，自己决定是 addTodo 还是 updateTodo */
  onSubmit: (text: string, subjectId: string, dueDate: string, kind: TodoKind) => void
}

/**
 * 任务面板（首页、计划·任务、科目页、目标页共用）：一行输入 + 类型 + 科目胶囊 +
 * 截止日期 + 提交。没传 `todo` 是新增，传了就是编辑 —— 字段完全一样，
 * 只是标题、按钮文案和初始值不同，不值得再写一个几乎重复的组件。
 *
 * 学习任务：科目和日期都必选，没选时按钮是禁用的，所以从这儿加/改的任务
 * 一定有归属、也一定能被提醒到。
 * 琐事：不归属任何科目，类型切过去就不显示科目胶囊了，日期照旧必填。
 * 成就任务（带 achievementId）：科目恒空、类型恒学习，所以编辑时这两行都不显示 ——
 * 放开会让它变成某个科目的任务，破坏「成就任务只活在目标页」。
 * 日期也可以不填（`locked` 时走可选日期），成就是激励，不是催办。
 *
 * 打开时才挂载（父层条件渲染），所以草稿和选中科目不用 effect 去重置。
 */
export default function AddTaskPanel({
  subjects,
  defaultSubjectId = '',
  todo,
  onClose,
  onSubmit,
}: Props) {
  // 成就任务不给改类型和科目，只改文字和日期
  const locked = todo?.achievementId !== undefined

  const [text, setText] = useState(todo?.text ?? '')
  const [kind, setKind] = useState<TodoKind>(locked ? 'study' : (todo?.kind ?? 'study'))
  const [subjectId, setSubjectId] = useState(locked ? '' : (todo?.subjectId ?? defaultSubjectId))
  // 老任务本来没截止日期时给今天：面板上看得见，不是偷偷补的。
  // 成就任务例外 —— 它们可以没日期，不替人补一个。
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? (locked ? '' : dayKey()))
  const inputRef = useRef<HTMLInputElement>(null)

  // 挂载后把焦点放进输入框；编辑时把光标放到末尾，接着改错字
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      const end = input.value.length
      input.setSelectionRange(end, end)
    }, 30)
    return () => window.clearTimeout(timer)
  }, [])

  // Esc 关闭
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const needSubject = kind === 'study' && !locked
  // 成就任务不要求日期；别的任务照旧必填，这样才能被到期提醒接住
  const canSubmit =
    text.trim().length > 0 && (locked || dueDate !== '') && (!needSubject || subjectId !== '')
  const title = todo ? '编辑任务' : '添加任务'

  function submit() {
    if (!canSubmit) return
    onSubmit(text.trim(), needSubject ? subjectId : '', dueDate, kind)
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__head">
          <span className="sheet__title">{title}</span>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="收起">
            ×
          </button>
        </div>

        <input
          ref={inputRef}
          className="input"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
          }}
          placeholder={needSubject ? '写一件要做的事…' : '写一件琐事，比如交材料、买书…'}
          aria-label="任务内容"
        />

        {!locked && (
          <div className="seg" role="radiogroup" aria-label="任务类型">
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'study'}
              className={kind === 'study' ? 'seg__btn seg__btn--active' : 'seg__btn'}
              onClick={() => setKind('study')}
            >
              学习
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'chore'}
              className={kind === 'chore' ? 'seg__btn seg__btn--active' : 'seg__btn'}
              onClick={() => setKind('chore')}
            >
              琐事
            </button>
          </div>
        )}

        {needSubject && (
          <div className="sheet__pills" role="radiogroup" aria-label="选择科目">
            {subjects.map(subject => {
              const active = subject.id === subjectId
              return (
                <button
                  key={subject.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={active ? 'choice choice--on' : 'choice'}
                  onClick={() => setSubjectId(subject.id)}
                >
                  {subject.name}
                </button>
              )
            })}
          </div>
        )}

        <DuePicker
          value={dueDate}
          onChange={setDueDate}
          label={locked ? '日期' : '截止'}
          quick={!locked}
          optional={locked}
        />

        {needSubject && subjectId === '' && (
          <p className="sheet__hint">先选一个科目，再{todo ? '保存' : '添加'}</p>
        )}
        {!locked && dueDate === '' && (
          <p className="sheet__hint">再选一个截止日期，到期前三天会提醒你</p>
        )}

        <button
          type="button"
          className="btn btn--primary sheet__submit"
          onClick={submit}
          disabled={!canSubmit}
        >
          {todo ? '保存' : '添加'}
        </button>
      </div>
    </div>
  )
}
