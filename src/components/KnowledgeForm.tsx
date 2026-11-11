import { useEffect, useRef, useState } from 'react'
import {
  KNOWLEDGE_TYPES,
  guessType,
  normalizeTags,
  titleFrom,
  typeLabel,
} from '../lib/knowledge'
import type { KnowledgeFileInput, KnowledgeInput } from '../lib/knowledge'
import { MAX_FILE_SIZE, formatFileSize, uploadFile } from '../lib/files'
import { compressImage, isCompressible } from '../lib/image'
import type { Knowledge, KnowledgeType } from '../lib/types'

type Props = {
  /** 有值 = 编辑这条：字段预填，标题和按钮换字 */
  entry?: Knowledge
  /**
   * 打开时焦点落在哪个框。默认标题；收藏行业动态时直接落在「一句话说明」——
   * 标题和链接已经从那条动态带过来了，要补的就是那句话。
   */
  focusField?: 'title' | 'summary'
  onClose: () => void
  onSubmit: (input: KnowledgeInput) => void
}

/** 记录上的四个文件字段摊成表单要的形状；老附件没有 url */
function fileOf(entry?: Knowledge): KnowledgeFileInput | null {
  if (!entry?.fileName) return null
  return {
    name: entry.fileName,
    size: entry.fileSize ?? 0,
    type: entry.fileType ?? '',
    url: entry.fileUrl ?? '',
  }
}

/**
 * 知识库的记录面板（右下角 + 打开，点列表正文也能打开）。
 *
 * 四个字段都不拦人：标题、链接、一句话说明、附件，**有任意一项就能保存**。
 * 标题没写就用文件名 / 网站名 / 说明开头顶上（titleFrom），说明没写就不占那一行 ——
 * 记东西最烦的是"先想标题再想说明"，这里不该有这道门槛。
 *
 * 类型默认按 `guessType` 自动判断（标题 / 说明 / 文件名都参与），
 * 但不摆一排按钮：平时只显示「类型 · 课程 · 自动判断」，点「改」才展开胶囊。
 * 手动点过某一颗就锁定，之后改文字不再覆盖。
 *
 * 编辑时不重算：打开时类型就是原来那条，改个错别字不会把它重新归类。
 *
 * 附件是「先选后传」：选中的文件只留在内存里，**点保存才真正传到 Storage**。
 * 中途关掉面板不会在 bucket 里留没人认领的文件；上传失败就停在这一步，
 * 不会出现「记录里写着地址、点开却 404」。
 */
export default function KnowledgeForm({ entry, focusField = 'title', onClose, onSubmit }: Props) {
  const [title, setTitle] = useState(entry?.title ?? '')
  const [url, setUrl] = useState(entry?.url ?? '')
  const [summary, setSummary] = useState(entry?.summary ?? '')
  // 标签在输入框里是「高数, 期末」这样一串，保存时再拆成数组
  const [tags, setTags] = useState((entry?.tags ?? []).join(', '))
  // 当前附件：编辑时先放原来那条，选了新文件就换成新的（还没传）
  const [file, setFile] = useState<KnowledgeFileInput | null>(fileOf(entry))
  // 新选的本地文件，保存时才上传；null = 没换文件
  const [picked, setPicked] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  // 图片在上传前先过一遍 canvas，压缩期间别再让人点提交
  const [compressing, setCompressing] = useState(false)
  const [dragging, setDragging] = useState(false)
  // 连选两张图时，只认最后一次的结果，前一张的压缩结果直接丢掉
  const pickSeq = useRef(0)
  // 编辑时视为「已经手动定过」，避免改标题把类型带走
  const [manual, setManual] = useState(Boolean(entry))
  const [type, setType] = useState<KnowledgeType>(entry?.type ?? 'exp')
  // 类型胶囊默认收起：平时只看得到「判断成了什么」，想改再点开
  const [typeOpen, setTypeOpen] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const summaryRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const target = focusField === 'summary' ? summaryRef : titleRef
    const timer = window.setTimeout(() => target.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [focusField])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, uploading])

  // 文件名也参与判断：手头多是「高数期末真题.pdf」这种，标题常常只写「文件」
  const guessed = guessType({ title, summary, fileName: file?.name })
  const current = manual ? type : guessed
  // 至少得留下点什么，不然列表里会出现一条点不开的空记录
  const canSubmit = Boolean(title.trim() || summary.trim() || url.trim() || file)
  const fallbackTitle = titleFrom({ title, summary, url, fileName: file?.name })

  /**
   * 选中（或拖进）一个文件：**图片先压缩，再查 10 MB**。
   *
   * 顺序不能反：一张 12 MB 的截图压完可能只有 800 KB，先拦下来就白拦了。
   * 压缩期间按钮禁用，避免点出两份；换文件时用序号丢弃过期的结果。
   */
  async function takeFile(next: File | null | undefined) {
    if (!next) return

    const seq = ++pickSeq.current
    setError('')

    let chosen = next
    if (isCompressible(next.type)) {
      setCompressing(true)
      try {
        chosen = await compressImage(next)
      } finally {
        if (seq === pickSeq.current) setCompressing(false)
      }
      if (seq !== pickSeq.current) return
    }

    if (chosen.size > MAX_FILE_SIZE) {
      // 压缩没起作用时别写「压缩后」，否则会让人以为压了却没用
      const after = chosen === next ? '' : '压缩后'
      setError(
        `「${next.name}」${after}仍有 ${formatFileSize(chosen.size)}，超过 10 MB，换个小的，或者先把文件放别处、这里只写标题`,
      )
      return
    }

    setPicked(chosen)
    setFile({ name: chosen.name, size: chosen.size, type: chosen.type, url: '' })
  }

  function clearFile() {
    setPicked(null)
    setFile(null)
    setError('')
  }

  async function submit() {
    if (!canSubmit || uploading || compressing) return

    let nextFile = file
    // 换了新文件才传；没换就保持原样（包括老的本地附件，不碰它的元信息）
    if (picked) {
      setUploading(true)
      setError('')
      try {
        const { url: fileUrl } = await uploadFile(picked)
        nextFile = { name: picked.name, size: picked.size, type: picked.type, url: fileUrl }
      } catch {
        setError('文件没能传到云端，检查一下网络再点一次；也可以先不传文件，只保存标题和说明')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    onSubmit({
      title,
      summary,
      url,
      tags: normalizeTags(tags),
      type: manual ? type : guessed,
      file: nextFile,
    })
  }

  return (
    <div className="sheet-layer">
      <div
        className="sheet-mask"
        onClick={() => {
          if (!uploading) onClose()
        }}
        aria-hidden="true"
      />

      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={entry ? '编辑记录' : '添加记录'}
      >
        <div className="sheet__head">
          <span className="sheet__title">{entry ? '编辑记录' : '添加记录'}</span>
          <button
            type="button"
            className="sheet__close"
            onClick={onClose}
            aria-label="收起"
            disabled={uploading}
          >
            ×
          </button>
        </div>

        <input
          ref={titleRef}
          className="input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit()
          }}
          placeholder="标题（可不填，会先用文件名）"
          aria-label="标题"
          maxLength={100}
        />

        <input
          className="input"
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit()
          }}
          placeholder="链接（可选）：https://…"
          aria-label="链接"
          maxLength={500}
        />

        <input
          ref={summaryRef}
          className="input"
          value={summary}
          onChange={e => setSummary(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit()
          }}
          placeholder="一句话说明（可不填）"
          aria-label="一句话说明"
          maxLength={200}
        />

        <input
          className="input"
          value={tags}
          onChange={e => setTags(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit()
          }}
          placeholder="标签（用逗号分隔，可留空）例如：高数, 期末, 老师发的"
          aria-label="标签"
          maxLength={200}
        />

        <span className="sheet__label">附件（可选）</span>

        <div
          className={['kfile', file ? 'kfile--has' : '', dragging ? 'kfile--over' : '']
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
            void takeFile(e.dataTransfer.files?.[0])
          }}
        >
          {file ? (
            <>
              <span className="kfile__row">
                <span className="kfile__name">{file.name}</span>
                <span className="kfile__size">{formatFileSize(file.size)}</span>
              </span>
              {/* 老附件只有名字、没有云端地址：说清楚，别让人以为点了会没反应。
                  刚选的新文件也是空 url，但它马上要上传，不该挂这句提示。 */}
              {!file.url && !picked && (
                <span className="kfile__note">
                  这个文件还留在旧版本地，换一个文件重新上传后才能在线预览
                </span>
              )}
              <span className="kfile__actions">
                <button
                  type="button"
                  className="kfile__btn"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || compressing}
                >
                  换一个
                </button>
                <button
                  type="button"
                  className="kfile__btn kfile__btn--remove"
                  onClick={clearFile}
                  disabled={uploading}
                >
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
                disabled={uploading || compressing}
              >
                {compressing ? '压缩中…' : '添加附件'}
              </button>
              <span className="kfile__tip">
                {compressing
                  ? '正在压缩图片，稍等一下…'
                  : 'PDF、Word、图片都行，单个不超过 10 MB（图片会自动压缩）；也可以直接把文件拖到这里'}
              </span>
            </>
          )}

          <input
            ref={fileRef}
            className="kfile__input"
            type="file"
            onChange={e => {
              void takeFile(e.target.files?.[0])
              // 清空 value，同一个文件改完再选一次也能触发 change
              e.target.value = ''
            }}
            aria-label="选择附件文件"
            hidden
          />
        </div>

        <p className="kfile__warn">请勿上传身份证、银行卡等敏感证件</p>

        {error && <p className="kfile__error">{error}</p>}

        <div className="typebar">
          <span className="typebar__label">类型</span>
          <span className={`ktag ktag--${current}`}>{typeLabel(current)}</span>
          <span className="typebar__note">{manual ? '手动选的' : '自动判断'}</span>
          <button
            type="button"
            className="typebar__btn"
            onClick={() => setTypeOpen(open => !open)}
            aria-expanded={typeOpen}
          >
            {typeOpen ? '收起' : '改'}
          </button>
        </div>

        {typeOpen && (
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
        )}

        <p className="sheet__hint">
          {!canSubmit
            ? '标题、说明、链接、文件，随便留一项就能添加'
            : !title.trim()
              ? `会以「${fallbackTitle}」为标题显示`
              : manual
                ? `类型已手动选为「${typeLabel(current)}」，改文字不会覆盖它`
                : '类型按标题、说明和文件名自动判断'}
        </p>

        <button
          type="button"
          className="btn btn--primary sheet__submit"
          onClick={() => void submit()}
          disabled={!canSubmit || uploading || compressing}
        >
          {uploading ? '上传中…' : entry ? '保存' : '添加'}
        </button>
      </div>
    </div>
  )
}
