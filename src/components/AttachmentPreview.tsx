import { useEffect, useState } from 'react'
import { formatFileSize } from '../lib/files'
import { docxToHtml, previewKind } from '../lib/preview'

type Props = {
  name: string
  size?: number
  /** 云端公开地址；早期本地附件没有 */
  url?: string
  type?: string
  onClose: () => void
}

/**
 * 附件预览层：占屏幕 80%，点空白或 Esc 关掉。
 *
 * - PDF：iframe 交给浏览器自带阅读器
 * - 图片：img 直接显示
 * - Word(docx)：mammoth 在浏览器里转成 HTML（点开时才动态加载那个包）
 * - 其余：老实说「该格式不支持预览」，给个下载按钮
 *
 * 早期版本的附件只有文件名、没有云端地址，这里会直接说明，
 * 而不是转圈等一个永远不会来的文件。
 */
export default function AttachmentPreview({ name, size, url, type, onClose }: Props) {
  const kind = previewKind(name, type)
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setHtml('')
    setFailed(false)

    if (!url) {
      setFailed(true)
      return
    }
    if (kind !== 'docx') return

    let alive = true
    setLoading(true)
    docxToHtml(url)
      .then(result => {
        if (alive) setHtml(result)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [url, kind])

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
        aria-label={`预览：${name}`}
        onClick={event => event.stopPropagation()}
      >
        <div className="preview__head">
          <span className="preview__name" title={name}>
            {name}
          </span>
          {typeof size === 'number' && size > 0 && (
            <span className="preview__size">{formatFileSize(size)}</span>
          )}

          {url && (
            <a className="btn btn--ghost preview__download" href={url} download={name} target="_blank" rel="noreferrer noopener">
              下载
            </a>
          )}
          <button type="button" className="sheet__close" onClick={onClose} aria-label="关闭预览">
            ×
          </button>
        </div>

        <div className={`preview__body preview__body--${kind}`}>
          {!url ? (
            <p className="preview__note">
              这个文件还留在旧版本的浏览器里，没有云端地址。编辑这条记录，重新选一次文件就能在线预览。
            </p>
          ) : kind === 'image' ? (
            <img className="preview__image" src={url} alt={name} />
          ) : kind === 'pdf' ? (
            <iframe className="preview__frame" src={url} title={name} />
          ) : kind === 'docx' ? (
            loading ? (
              <p className="preview__note">正在打开…</p>
            ) : failed ? (
              <div className="preview__note">
                <p>这个 Word 文件打不开，可能是文件损坏了。下载下来用别的软件试试。</p>
                <a className="btn btn--primary" href={url} download={name}>
                  下载
                </a>
              </div>
            ) : (
              // mammoth 的输出就是 docx 里的段落/表格/标题，直接排进预览区
              <div
                className="preview__doc"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          ) : (
            <div className="preview__note">
              <p>该格式不支持预览，下载后用别的软件打开。</p>
              <a className="btn btn--primary" href={url} download={name}>
                下载
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
