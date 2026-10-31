import { useState } from 'react'
import DuePicker from './DuePicker'
import { dayKey } from '../lib/date'

type Props = {
  /** 输入框占位文案，带科目名更清楚这条会加到哪 */
  placeholder: string
  /** 屏幕阅读器用的标签 */
  label: string
  onAdd: (text: string, dueDate: string) => void
}

/**
 * 科目页的任务输入条：文字 + 截止日期，加进哪个科目由调用方在 onAdd 里决定。
 * 日期默认今天，回车和「添加」按钮走同一个入口，缺文字或缺日期都不加。
 *
 * 日期选完不重置：连着记几件同一天的事，不用每次重选。
 */
export default function TaskInput({ placeholder, label, onAdd }: Props) {
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState(dayKey())
  const canSubmit = text.trim().length > 0 && dueDate !== ''

  function submit() {
    const value = text.trim()
    if (!value || !dueDate) return
    onAdd(value, dueDate)
    setText('')
  }

  return (
    <div className="composer">
      <div className="composer__row">
        <input
          className="input"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
          }}
          placeholder={placeholder}
          aria-label={label}
        />
        <button type="button" className="btn btn--primary" onClick={submit} disabled={!canSubmit}>
          添加
        </button>
      </div>

      <DuePicker value={dueDate} onChange={setDueDate} />
    </div>
  )
}
