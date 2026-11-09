import { useEffect, useRef, useState } from 'react'
import { formatFileSize } from '../lib/files'
import { OFFICE_TIMEOUT, docxToHtml, officeViewerUrl, previewKind } from '../lib/preview'

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
 * - 其他 Office：交给微软的在线查看器，10 秒没回来就当它打不开；
 *   底部**始终**留一行「打不开？下载原文件」—— 那台服务器在国外，
 *   慢或被拦是常事，不能让人等满 10 秒才知道有退路
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
  /** Office 预览自己超时：跟「文件打不开」分开说，文案不一样 */
  const [officeTimeout, setOfficeTimeout] = useState(false)
  const officeTimer = useRef<number | null>(null)

  useEffect(() => {
    const clearOfficeTimer = () => {
      if (officeTimer.current !== null) {
        window.clearTimeout(officeTimer.current)
        officeTimer.current = null
      }
    }

    setHtml('')
    setFailed(false)
    setOfficeTimeout(false)
    clearOfficeTimer()

    if (!url) {
      setFailed(true)
      return
    }

    if (kind === 'office') {
      // iframe 跨域，读不到内容；能等的只有「页面有没有回来」这一件事
      officeTimer.current = window.setTimeout(() => {
        officeTimer.current = null
        setOfficeTimeout(true)
      }, OFFICE_TIMEOUT)
      return clearOfficeTimer
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

  /** iframe 回来了就撤掉计时器；至于里面显示的是正文还是它自己的错误页，跨域看不出来 */
  const handleFrameLoad = () => {
    if (officeTimer.current !== null) {
      window.clearTimeout(officeTimer.current)
      officeTimer.current = null
    }
  }

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
          ) : kind === 'office' ? (
            officeTimeout ? (
              <div className="preview__note">
                <p>预览加载超时，可下载查看。</p>
                <a className="btn btn--primary" href={url} download={name}>
                  下载
                </a>
              </div>
            ) : (
              <iframe
                className="preview__frame"
                src={officeViewerUrl(url)}
                title={name}
                onLoad={handleFrameLoad}
                referrerPolicy="no-referrer"
              />
            )
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

        {/* Office 走的是微软的服务器，慢或被拦都不奇怪：退路一直在，不用等超时 */}
        {url && kind === 'office' && (
          <div className="preview__foot">
            <a href={url} download={name} target="_blank" rel="noreferrer noopener">
              打不开？下载原文件
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
