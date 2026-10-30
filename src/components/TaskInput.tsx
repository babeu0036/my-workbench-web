import { useState } from 'react'

type Props = {
  /** 输入框占位文案，带科目名更清楚这条会加到哪 */
  placeholder: string
  /** 屏幕阅读器用的标签 */
  label: string
  onAdd: (text: string) => void
}

/**
 * 任务输入条：只管收文字，加进哪个科目由调用方在 onAdd 里决定。
 * 回车和「添加」按钮走同一个入口，空内容直接忽略。
 */
export default function TaskInput({ placeholder, label, onAdd }: Props) {
  const [text, setText] = useState('')
  const canSubmit = text.trim().length > 0

  function submit() {
    const value = text.trim()
    if (!value) return
    onAdd(value)
    setText('')
  }

  return (
    <div className="composer">
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
  )
}
