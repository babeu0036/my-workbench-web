import { useEffect, useState } from 'react'

type Props = {
  title: string
  /** 空状态那一句话 */
  note: string
  /** 点右下角 + 时浮出来的一句提示 */
  toast: string
}

/**
 * 占位页：只有标题 + 一句空状态 + 一个点不出东西的 +。
 *
 * 这一版调整侧边栏结构，「目标」「知识库」两个入口先立起来、内容留到后面补。
 * 之所以不把 + 藏掉：空状态那句写的是「点右下角添加」，按钮不在会显得没做完；
 * 点了给一句明确的话，比点了毫无反应好。
 */
export default function ComingSoonPage({ title, note, toast }: Props) {
  const [open, setOpen] = useState(false)

  // 2.6 秒自己消失，和课程表保存后那条提示一个节奏
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setOpen(false), 2600)
    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <>
      <div className="page">
        <h2 className="page__title">{title}</h2>
        <p className="placeholder__note">{note}</p>
      </div>

      <button
        type="button"
        className="fab"
        onClick={() => setOpen(true)}
        aria-label="添加"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}
