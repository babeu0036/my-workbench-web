import { useEffect, useRef, useState } from 'react'
import { KNOWLEDGE_TYPES, guessType } from '../lib/knowledge'
import type { KnowledgeInput } from '../lib/knowledge'
import {
  MAX_FILE_SIZE,
  attachmentFromFile,
  formatFileSize,
  putAttachment,
} from '../lib/files'
import type { Attachment, Knowledge, KnowledgeType } from '../lib/types'

type Props = {
  /** 有值 = 编辑这条：字段预填，标题和按钮换字 */
  entry?: Knowledge
  onClose: () => void
  onSubmit: (input: KnowledgeInput) => void
}

/**
 * 知识库的记录面板（右下角 + 打开，点列表正文也能打开）。
 *
 * 字段：标题（必填）、链接（可选）、一句话说明（必填）、附件（可选）。
 * 类型默认按 `guessType` 自动判断，标题 / 说明 / 链接 / 文件名一改就跟着重算；
 * 只要用户手动点过某一颗，就锁成手动值，之后改文字不再覆盖 ——
 * 自动判断只是省一次点击，不能替用户做决定。
 *
 * 编辑时不重算：打开时类型就是原来那条，改个错别字不会把它重新归类。
 *
 * 附件是「先选后存」：选中的文件只留在内存里，点保存才写进 IndexedDB。
 * 中途关掉面板不会留下没人认领的文件；换掉或移除旧附件后，
 * 由页面在保存成功后清掉旧文件。
 *
 * 跟添加任务、添加成就同一个壳（`.sheet`）：底部滑出、Esc 关闭、自动聚焦。
 */
export default function KnowledgeForm({ entry, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState(entry?.title ?? '')
  const [url, setUrl] = useState(entry?.url ?? '')
  const [summary, setSummary] = useState(entry?.summary ?? '')
  // 当前附件：编辑时先放原来那条，选了新文件就换成新的
  const [attachment, setAttachment] = useState<Attachment | null>(entry?.attachment ?? null)
  // 新选的文件本体，保存时才落库；null = 没换文件
  const [picked, setPicked] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  // 编辑时视为「已经手动定过」，避免改标题把类型带走
  const [manual, setManual] = useState(Boolean(entry))
  const [type, setType] = useState<KnowledgeType>(entry?.type ?? 'mine')
  const titleRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  // 文件名也参与判断：手头多是「奖学金评定办法.pdf」这种，标题常常只写「文件」
  const guessed = guessType({ title, summary, url, fileName: attachment?.name })
  const current = manual ? type : guessed
  const canSubmit = title.trim().length > 0 && summary.trim().length > 0

  /** 选中（或拖进）一个文件：只检查大小、记下元信息，不落库 */
  function takeFile(file: File | null | undefined) {
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setError(
        `「${file.name}」有 ${formatFileSize(file.size)}，超过 20 MB，换个小的，或者先把文件放别处、这里只写标题`,
      )
      return
    }
    setError('')
    setPicked(file)
    setAttachment(attachmentFromFile(file))
  }

  function clearFile() {
    setPicked(null)
    setAttachment(null)
    setError('')
  }

  async function submit() {
    if (!canSubmit || busy) return

    // 换了文件才写；没换就不碰 IndexedDB
    if (picked && attachment) {
      setBusy(true)
      const ok = await putAttachment(attachment.key, picked)
      setBusy(false)
      if (!ok) {
        setError('文件没能存进浏览器（可能是空间不够），可以先不传文件，只保存标题和说明')
        return
      }
    }

    onSubmit({
      title,
      summary,
      url,
      type: manual ? type : guessed,
      // null 表示要清掉原附件；有值就是当前这个
      attachment,
    })
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

        <span className="sheet__label">附件（可选）</span>

        <div
          className={[
            'kfile',
            attachment ? 'kfile--has' : '',
            dragging ? 'kfile--over' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onDragOver={e => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            takeFile(e.dataTransfer.files?.[0])
          }}
        >
          {attachment ? (
            <>
              <span className="kfile__row">
                <span className="kfile__name">{attachment.name}</span>
                <span className="kfile__size">{formatFileSize(attachment.size)}</span>
              </span>
              <span className="kfile__actions">
                <button
                  type="button"
                  className="kfile__btn"
                  onClick={() => fileRef.current?.click()}
                >
                  换一个
                </button>
                <button type="button" className="kfile__btn kfile__btn--remove" onClick={clearFile}>
                  移除
                </button>
              </span>
            </>
          ) : (
            <>
              <button
                type="button"
                className="kfile__pick"
                onClick={() => fileRef.current?.click()}
              >
                选择文件
              </button>
              <span className="kfile__tip">
                PDF、Word、图片都行，单个不超过 20 MB；也可以直接把文件拖到这里
              </span>
            </>
          )}

          <input
            ref={fileRef}
            className="kfile__input"
            type="file"
            onChange={e => {
              takeFile(e.target.files?.[0])
              // 清空 value，同一个文件改完再选一次也能触发 change
              e.target.value = ''
            }}
            aria-label="选择附件文件"
            hidden
          />
        </div>

        {error && <p className="kfile__error">{error}</p>}

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
            : '按标题、说明、链接和文件名自动判断，可以手动改'}
        </p>

        <button
          type="button"
          className="btn btn--primary sheet__submit"
          onClick={submit}
          disabled={!canSubmit || busy}
        >
          {busy ? '保存中…' : entry ? '保存' : '添加'}
        </button>
      </div>
    </div>
  )
}
