import { useEffect, useRef, useState } from 'react'
import { dayKey } from '../lib/date'
import { isDateKey, orderRange } from '../lib/stages'
import type { Stage } from '../lib/types'

type Props = {
  /** 传了就是编辑，不传是新建 */
  stage?: Stage
  onClose: () => void
  onSubmit: (input: { title: string; startKey: string; endKey: string }) => void
}

/**
 * 新建 / 编辑阶段的面板。只有三个字段：名字、开始、结束。
 *
 * 起止写反了不报错，保存时自动换过来（跟读盘时一个规矩）——
 * 为了填反两个日期就让人重填一遍，没必要。
 *
 * 跟其它面板同一套壳（`.sheet-layer` / `.sheet`）：底部滑出、点遮罩或按 Esc 收起。
 */
export default function StageForm({ stage, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState(stage?.title ?? '')
  const [start, setStart] = useState(stage?.startKey ?? dayKey())
  const [end, setEnd] = useState(stage?.endKey ?? '')
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

  const canSubmit = title.trim().length > 0 && isDateKey(start) && isDateKey(end)

  function submit() {
    if (!canSubmit) return
    const [startKey, endKey] = orderRange(start, end)
    onSubmit({ title: title.trim(), startKey, endKey })
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={stage ? '编辑阶段' : '新建阶段'}
      >
        <div className="sheet__head">
          <span className="sheet__title">{stage ? '编辑阶段' : '新建阶段'}</span>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="收起">
            ×
          </button>
        </div>

        <input
          ref={titleRef}
          className="input"
          value={title}
          onChange={event => setTitle(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') submit()
          }}
          placeholder="名字：大一上 / 考研冲刺 / 暑假"
          aria-label="阶段名字"
          maxLength={20}
        />

        <div className="stageform">
          <div className="stageform__dates">
            <label className="stageform__field">
              <span>开始</span>
              <input
                type="date"
                className="input"
                value={start}
                onChange={event => setStart(event.target.value)}
                aria-label="阶段开始"
              />
            </label>
            <label className="stageform__field">
              <span>结束</span>
              <input
                type="date"
                className="input"
                value={end}
                onChange={event => setEnd(event.target.value)}
                aria-label="阶段结束"
              />
            </label>
          </div>
        </div>

        <p className="sheet__hint">
          开始和结束都含当天；写反了保存时会自动换过来。阶段之间可以重叠。
        </p>

        <button
          type="button"
          className="btn btn--primary sheet__submit"
          onClick={submit}
          disabled={!canSubmit}
        >
          {stage ? '保存' : '新建'}
        </button>
      </div>
    </div>
  )
}
