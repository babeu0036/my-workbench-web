import { useEffect, useRef, useState } from 'react'
import type { Subject } from '../lib/types'

type Props = {
  /** 只放真科目，未分类不在里面 —— 这个面板不允许产生未分类 */
  subjects: Subject[]
  /** 上次选中的科目；没有或不合法时传 ''，进来就是没选的状态 */
  defaultSubjectId: string
  onClose: () => void
  onAdd: (text: string, subjectId: string) => void
}

/**
 * 首页的添加面板：一行输入 + 科目胶囊 + 添加。
 * 科目必选：没选时「添加」是禁用的，所以从这儿加的任务一定有归属。
 *
 * 打开时才挂载（父层条件渲染），所以草稿和选中科目不用 effect 去重置，
 * 直接用初始值就行 —— 每次打开都是干净的。
 */
export default function AddTaskPanel({ subjects, defaultSubjectId, onClose, onAdd }: Props) {
  const [text, setText] = useState('')
  const [subjectId, setSubjectId] = useState(defaultSubjectId)
  const inputRef = useRef<HTMLInputElement>(null)

  // 挂载后把焦点放进输入框，省一次点击
  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30)
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

  const canSubmit = text.trim().length > 0 && subjectId !== ''

  function submit() {
    if (!canSubmit) return
    onAdd(text.trim(), subjectId)
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="添加任务">
        <div className="sheet__head">
          <span className="sheet__title">添加任务</span>
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
          placeholder="写一件要做的事…"
          aria-label="任务内容"
        />

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

        {subjectId === '' && <p className="sheet__hint">先选一个科目，再添加</p>}

        <button
          type="button"
          className="btn btn--primary sheet__submit"
          onClick={submit}
          disabled={!canSubmit}
        >
          添加
        </button>
      </div>
    </div>
  )
}
