import { useEffect, useState } from 'react'

type Props = {
  onConfirm: () => void
  /** 第一态的文案 */
  label?: string
  className?: string
}

/**
 * 删除按钮：点一下变成「确定 / 取消」，4 秒没动自动复原。
 * 不用 window.confirm —— 嵌在 sandbox iframe 里（比如预览面板）时，
 * 浏览器会把 confirm 静默忽略并返回 false，删除就成了摆设。
 */
export default function ConfirmDelete({ onConfirm, label = '删除', className = '' }: Props) {
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!asking) return
    const timer = window.setTimeout(() => setAsking(false), 4000)
    return () => window.clearTimeout(timer)
  }, [asking])

  if (!asking) {
    return (
      <button
        type="button"
        className={`btn btn--ghost btn--danger ${className}`.trim()}
        onClick={() => setAsking(true)}
      >
        {label}
      </button>
    )
  }

  return (
    <span className={`confirm ${className}`.trim()}>
      <button
        type="button"
        className="btn btn--danger-solid"
        aria-label="确定删除"
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
      >
        确定
      </button>
      <button type="button" className="btn btn--ghost" onClick={() => setAsking(false)}>
        取消
      </button>
    </span>
  )
}
