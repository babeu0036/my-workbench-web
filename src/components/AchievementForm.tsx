import { useEffect, useRef, useState } from 'react'

type Props = {
  onClose: () => void
  onAdd: (title: string, note: string) => void
}

/**
 * 新建成就的面板（右下角 + 打开）。只要标题，备注可选。
 *
 * 跟添加任务那个面板同一套壳（`.sheet-layer` / `.sheet`）：底部滑出、点遮罩或
 * 按 Esc 收起、打开就把焦点放进输入框。成就下面挂什么任务不在这儿填 ——
 * 建完在卡片里一条条加，免得一次要填一堆。
 */
export default function AchievementForm({ onClose, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => titleRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const canSubmit = title.trim().length > 0

  function submit() {
    if (!canSubmit) return
    onAdd(title.trim(), note.trim())
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="添加成就">
        <div className="sheet__head">
          <span className="sheet__title">添加成就</span>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="收起">
            ×
          </button>
        </div>

        <input
          ref={titleRef}
          className="input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="想做成的一件事，比如「拿下数学建模国赛」"
          aria-label="成就名称"
          maxLength={60}
        />

        <input
          className="input"
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="备注（可选）：为什么做、做到什么程度算成"
          aria-label="成就备注"
          maxLength={120}
        />

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
