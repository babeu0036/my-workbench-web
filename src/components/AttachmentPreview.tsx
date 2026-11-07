import { useEffect, useRef, useState } from 'react'
import {
  MAX_TEXT_PREVIEW,
  formatFileSize,
  getAttachment,
  previewKind,
} from '../lib/files'
import type { Attachment } from '../lib/types'

type Props = {
  attachment: Attachment
  onClose: () => void
}

/**
 * 附件预览层：在应用里直接看，不再让浏览器每次点都下载一遍。
 *
 * 图片、PDF、纯文本、音视频都由浏览器自己渲染；Word / PPT / 压缩包这类
 * 浏览器看不懂的，才显示「下载」按钮 —— 点了才落到本地，不点就不落。
 *
 * 文件从 IndexedDB 里读出来现开一个 blob 地址，关掉就释放。
 * 换设备同步过来的记录只有文件名、没有文件本体，这里会说明白。
 */
export default function AttachmentPreview({ attachment, onClose }: Props) {
  const kind = previewKind(attachment)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [failed, setFailed] = useState(false)
  const urlRef = useRef('')

  useEffect(() => {
    let alive = true
    setUrl('')
    setText('')
    setTruncated(false)
    setFailed(false)

    void (async () => {
      const blob = await getAttachment(attachment.key)
      if (!alive) return
      if (!blob) {
        setFailed(true)
        return
      }

      const objectUrl = URL.createObjectURL(blob)
      urlRef.current = objectUrl
      setUrl(objectUrl)

      if (kind === 'text') {
        const slice = blob.slice(0, MAX_TEXT_PREVIEW)
        const content = await slice.text()
        if (!alive) return
        setText(content)
        setTruncated(blob.size > MAX_TEXT_PREVIEW)
      }
    })()

    return () => {
      alive = false
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = ''
      }
    }
  }, [attachment.key, kind])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="preview-layer" onClick={onClose} role="presentation">
      <div
        className="preview"
        role="dialog"
        aria-modal="true"
        aria-label={`预览：${attachment.name}`}
        onClick={event => event.stopPropagation()}
      >
        <div className="preview__head">
          <span className="preview__name" title={attachment.name}>
            {attachment.name}
          </span>
          <span className="preview__size">{formatFileSize(attachment.size)}</span>

          {url && (
            <a className="btn btn--ghost preview__download" href={url} download={attachment.name}>
              下载
            </a>
          )}
          <button type="button" className="sheet__close" onClick={onClose} aria-label="关闭预览">
            ×
          </button>
        </div>

        <div className={`preview__body preview__body--${kind}`}>
          {failed ? (
            <p className="preview__note">这台设备上没有这个文件（同步过来的记录只带文件名）</p>
          ) : !url ? (
            <p className="preview__note">正在打开…</p>
          ) : kind === 'image' ? (
            <img className="preview__image" src={url} alt={attachment.name} />
          ) : kind === 'pdf' ? (
            <iframe className="preview__frame" src={url} title={attachment.name} />
          ) : kind === 'text' ? (
            <>
              <pre className="preview__text">{text}</pre>
              {truncated && <p className="preview__note">文件太大，只显示了开头一部分</p>}
            </>
          ) : kind === 'video' ? (
            <video className="preview__media" src={url} controls />
          ) : kind === 'audio' ? (
            <div className="preview__note">
              <audio className="preview__media" src={url} controls />
            </div>
          ) : (
            <div className="preview__note">
              <p>这种文件浏览器里看不了，需要下载后用别的软件打开。</p>
              <a className="btn btn--primary" href={url} download={attachment.name}>
                下载
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
