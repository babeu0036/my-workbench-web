import { useEffect, useRef, useState } from 'react'
import DuePicker from './DuePicker'
import { nextWeekSundayKey } from '../lib/reviews'
import type { Achievement } from '../lib/types'

type Props = {
  achievement: Achievement
  /** 默认截止日期（下周日），可以改 */
  defaultDate: string
  onClose: () => void
  /** 确认：文字 + 日期。文字是必填的，空着按钮点不动 */
  onSubmit: (text: string, dueDate: string) => void
}

/**
 * 复盘里「下周做它」的小弹窗：把一句笼统的「下周继续」翻译成一条具体的待办。
 *
 * 上面是这条里程碑的标题和「面试能说」—— 提醒为什么值得做；
 * 下面一个必填的输入框和日期（默认下周日）。
 *
 * 不做「先想好再点」的两步确认：输完回车就走，和别处的输入条一个手感。
 */
export default function PlanNextWeek({ achievement, defaultDate, onClose, onSubmit }: Props) {
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState(defaultDate || nextWeekSundayKey())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const ready = text.trim().length > 0

  function submit() {
    if (!ready) return
    onSubmit(text.trim(), dueDate)
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="下周做它">
        <div className="sheet__head">
          <span className="sheet__title">下周做它</span>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="收起">
            ×
          </button>
        </div>

        <p className="sheet__hint">「{achievement.title}」</p>
        {achievement.why.trim() && <p className="sheet__why">{achievement.why.trim()}</p>}

        <input
          ref={inputRef}
          className="input"
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') submit()
            if (event.key === 'Escape') onClose()
          }}
          placeholder="下周具体做什么，比如「把数据手册第 3 章读完」"
          aria-label="下周具体做什么"
          maxLength={80}
        />

        <DuePicker value={dueDate} onChange={setDueDate} quick={false} />

        <button
          type="button"
          className="btn btn--primary sheet__submit"
          onClick={submit}
          disabled={!ready}
        >
          加进下周
        </button>
      </div>
    </div>
  )
}
