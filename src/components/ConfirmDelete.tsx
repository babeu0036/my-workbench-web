import { useEffect, useState } from 'react'

type Props = {
  onConfirm: () => void
  /** 第一态的文案 */
  label?: string
  className?: string
  /**
   * 第二态里那行小字，说清楚「按下去会连带删掉什么」。
   * 比如阶段那条：「该阶段下有 2 个里程碑，将一并删除」。
   */
  hint?: string
}

/**
 * 删除按钮：点一下变成「确定 / 取消」，4 秒没动自动复原。
 * 不用 window.confirm —— 嵌在 sandbox iframe 里（比如预览面板）时，
 * 浏览器会把 confirm 静默忽略并返回 false，删除就成了摆设。
 *
 * 带 hint 时那一行会换到按钮下面（flex-wrap + 100% 宽度），
 * 窄屏上按钮不会因为这个提示被挤变形。
 */
export default function ConfirmDelete({
  onConfirm,
  label = '删除',
  className = '',
  hint,
}: Props) {
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
    <span className={`confirm ${hint ? 'confirm--stack' : ''} ${className}`.trim()}>
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
      {hint && <span className="confirm__hint">{hint}</span>}
    </span>
  )
}
