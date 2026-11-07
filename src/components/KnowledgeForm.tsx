import { useEffect, useRef, useState } from 'react'
import { KNOWLEDGE_TYPES, guessType } from '../lib/knowledge'
import type { KnowledgeInput } from '../lib/knowledge'
import type { Knowledge, KnowledgeType } from '../lib/types'

type Props = {
  /** 有值 = 编辑这条：字段预填，标题和按钮换字 */
  entry?: Knowledge
  onClose: () => void
  onSubmit: (input: KnowledgeInput) => void
}

/**
 * 知识库的记录面板（右下角 + 打开，点列表正文也能打开）。
 *
 * 三个字段：标题（必填）、链接（可选）、一句话说明（必填）。
 * 类型默认按 `guessType` 自动判断，标题 / 说明 / 链接一改就跟着重算；
 * 只要用户手动点过某一颗，就锁成手动值，之后改文字不再覆盖 ——
 * 自动判断只是省一次点击，不能替用户做决定。
 *
 * 编辑时不重算：打开时类型就是原来那条，改个错别字不会把它重新归类。
 *
 * 跟添加任务、添加成就同一个壳（`.sheet`）：底部滑出、Esc 关闭、自动聚焦。
 */
export default function KnowledgeForm({ entry, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState(entry?.title ?? '')
  const [url, setUrl] = useState(entry?.url ?? '')
  const [summary, setSummary] = useState(entry?.summary ?? '')
  // 编辑时视为「已经手动定过」，避免改标题把类型带走
  const [manual, setManual] = useState(Boolean(entry))
  const [type, setType] = useState<KnowledgeType>(entry?.type ?? 'mine')
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

  const guessed = guessType({ title, summary, url })
  const current = manual ? type : guessed
  const canSubmit = title.trim().length > 0 && summary.trim().length > 0

  function submit() {
    if (!canSubmit) return
    onSubmit({ title, summary, url, type: manual ? type : guessed })
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={entry ? '编辑记录' : '添加记录'}
      >
        <div className="sheet__head">
          <span className="sheet__title">{entry ? '编辑记录' : '添加记录'}</span>
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
          placeholder="标题，比如「2026 年奖学金评定办法」"
          aria-label="标题"
          maxLength={100}
        />

        <input
          className="input"
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="链接（可选）：https://…"
          aria-label="链接"
          maxLength={500}
        />

        <input
          className="input"
          value={summary}
          onChange={e => setSummary(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="一句话说明，比如「今年的评定条件和材料清单」"
          aria-label="一句话说明"
          maxLength={200}
        />

        <span className="sheet__label">类型</span>

        <div className="sheet__pills" role="radiogroup" aria-label="记录类型">
          {KNOWLEDGE_TYPES.map(item => {
            const on = item.key === current
            return (
              <button
                key={item.key}
                type="button"
                role="radio"
                aria-checked={on}
                className={on ? 'choice choice--on' : 'choice'}
                onClick={() => {
                  setType(item.key)
                  setManual(true)
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <p className="sheet__hint">
          {manual
            ? `已手动选为「${KNOWLEDGE_TYPES.find(item => item.key === type)?.label}」，改文字不会覆盖它`
            : '按标题、说明和链接自动判断，可以手动改'}
        </p>

        <button
          type="button"
          className="btn btn--primary sheet__submit"
          onClick={submit}
          disabled={!canSubmit}
        >
          {entry ? '保存' : '添加'}
        </button>
      </div>
    </div>
  )
}
