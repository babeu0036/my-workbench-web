import { useEffect, useRef, useState } from 'react'
import { KNOWLEDGE_TYPES, normalizeTags, typeLabel } from '../lib/knowledge'
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
 * 一进来只有三样：标题、一句话说明、分类。
 * - 标题必填 —— 没有标题的记录在列表里认不出来；
 * - 说明选填；
 * - 分类可选，默认「先不分类」，不选也能存（存下去就是未分类，之后在详情里补）。
 *
 * 链接、附件、标签都折进「更多」，默认收起 —— 平时记一条东西用不到它们，
 * 一条条摊开会把人吓退。编辑一条本来带链接 / 附件 / 标签的记录时自动展开，
 * 免得看着像「东西丢了」。
 *
 * 附件是「先选后传」：选中的文件只留在内存里，**点保存才真正传到 Storage**。
 * 中途关掉面板不会在 bucket 里留没人认领的文件；上传失败就停在这一步，
 * 不会出现「记录里写着地址、点开却 404」。
 */
export default function KnowledgeForm({ entry, focusField = 'title', onClose, onSubmit }: Props) {
  const [title, setTitle] = useState(entry?.title ?? '')
  const [summary, setSummary] = useState(entry?.summary ?? '')
  // 空字符串 = 先不分类，和记录里的 type 一一对应
  const [type, setType] = useState<KnowledgeType | ''>(entry?.type ?? '')
  const [url, setUrl] = useState(entry?.url ?? '')
  // 标签在输入框里是「高数, 期末」这样一串，保存时再拆成数组
  const [tags, setTags] = useState((entry?.tags ?? []).join(', '))
  // 当前附件：编辑时先放原来那条，选了新文件就换成新的（还没传）
  const [file, setFile] = useState<KnowledgeFileInput | null>(fileOf(entry))
  // 新选的本地文件，保存时才上传；null = 没换文件
  const [picked, setPicked] = useState<File | null>(null)
  /**
   * 「更多」默认收起。编辑一条本来就带链接 / 附件 / 标签的记录时展开，
   * 否则用户点开面板只看到空空的标题，会以为原来那些内容丢了。
   */
  const [moreOpen, setMoreOpen] = useState(
    Boolean(entry && (entry.url || entry.fileName || (entry.tags ?? []).length > 0)),
  )
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  // 图片在上传前先过一遍 canvas，压缩期间别再让人点提交
  const [compressing, setCompressing] = useState(false)
  const [dragging, setDragging] = useState(false)
  // 连选两张图时，只认最后一次的结果，前一张的压缩结果直接丢掉
  const pickSeq = useRef(0)
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

  // 标题必填：一条没标题的记录在列表里没法认
  const canSubmit = Boolean(title.trim())
  // 收起状态下也要让人知道「里面已经有东西了」
  const moreItems = [
    url.trim() ? '链接' : '',
    file ? '附件' : '',
    normalizeTags(tags).length > 0 ? '标签' : '',
  ].filter(Boolean)

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
      type,
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
          placeholder="标题（必填）"
          aria-label="标题"
          maxLength={100}
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

        <span className="sheet__label">分类（可选）</span>

        <div className="sheet__pills" role="radiogroup" aria-label="记录分类">
          {[{ key: '' as const, label: '先不分类' }, ...KNOWLEDGE_TYPES].map(item => {
            const on = item.key === type
            return (
              <button
                key={item.key || 'none'}
                type="button"
                role="radio"
                aria-checked={on}
                className={on ? 'choice choice--on' : 'choice'}
                onClick={() => setType(item.key)}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="sheet__more"
          onClick={() => setMoreOpen(open => !open)}
          aria-expanded={moreOpen}
          aria-controls="sheet-more-body"
        >
          <span className="sheet__more-label">更多</span>
          <span className="sheet__more-hint">
            {moreItems.length > 0 ? `已填：${moreItems.join(' · ')}` : '链接、附件、标签'}
          </span>
          <span className="sheet__more-mark">{moreOpen ? '收起' : '展开'}</span>
        </button>

        {moreOpen && (
          <div className="sheet__more-body" id="sheet-more-body">
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
          </div>
        )}

        {error && <p className="kfile__error">{error}</p>}

        <p className="sheet__hint">
          {!canSubmit
            ? '标题必填：一句话写清这是什么'
            : type === ''
              ? '还没分类，先不分类也能存，之后在详情里补'
              : `分类：${typeLabel(type)}`}
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
