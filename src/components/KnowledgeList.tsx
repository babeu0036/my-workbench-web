import ConfirmDelete from './ConfirmDelete'
import { SUMMARY_TITLE_MAX, typeLabel } from '../lib/knowledge'
import { formatFileSize } from '../lib/files'
import type { Knowledge } from '../lib/types'

type Props = {
  /** 已经筛过、排过序的记录，这个组件不再动数据 */
  items: Knowledge[]
  onEdit: (id: number) => void
  onRemove: (id: number) => void
  /** 打开附件预览：文件在 Supabase Storage，点开就地看 */
  onPreview: (item: Knowledge) => void
}

/**
 * 没写标题、拿一句话当标题时，标题和说明会是同一段文字 ——
 * 再在下面显示一遍等于重复，直接不显示。
 */
function showSummary(item: Knowledge): boolean {
  if (!item.summary) return false
  if (item.title === item.summary) return false
  return item.title !== `${item.summary.slice(0, SUMMARY_TITLE_MAX)}…`
}

/**
 * 知识库列表：一条一块，类型标签 + 标题同一行，下面是那句话。
 *
 * 点标签 / 标题 / 说明那一整块进编辑，链接和附件单独做成可点元素 ——
 * 放在同一个按钮里的话，点「打开文件」会先触发编辑面板，等于点不开。
 * 删除走 ConfirmDelete（原地变「确定 / 取消」），不用 window.confirm。
 *
 * 附件显示文件名和大小，点开在弹出层里预览；
 * 早期版本留下的老附件只有名字没有地址，点开会提示重新上传。
 */
export default function KnowledgeList({ items, onEdit, onRemove, onPreview }: Props) {
  return (
    <ul className="list">
      {items.map(item => (
        <li key={item.id} className="row row--knowledge">
          <span className="row__body">
            <button
              type="button"
              className="krow__main"
              onClick={() => onEdit(item.id)}
              aria-label={`编辑：${item.title}`}
            >
              <span className="krow__head">
                {/* 未分类（type 为空）用另一种淡色标签，跟五类的彩色标签区分开 */}
                <span className={item.type ? `ktag ktag--${item.type}` : 'ktag ktag--none'}>
                  {typeLabel(item.type)}
                </span>
                <span className="row__text krow__title">{item.title}</span>
              </span>
              {showSummary(item) && <span className="krow__summary">{item.summary}</span>}
              {/* 收藏来的行业动态只带标题和链接，说明是空的 —— 灰字提示一句，点进正文就能补。
                  一句话速记进来的条目不提示：它本身就是那句话，再催「补一句说明」是废话。 */}
              {!item.summary && (item.url || item.fileName) && (
                <span className="krow__hint">补一句说明</span>
              )}
              {(item.tags ?? []).length > 0 && (
                <span className="krow__tags">
                  {(item.tags ?? []).map(tag => (
                    <span key={tag} className="krow__tag">
                      #{tag}
                    </span>
                  ))}
                </span>
              )}
            </button>

            <span className="krow__sources">
              {item.fileName && (
                <button
                  type="button"
                  className="krow__file"
                  onClick={() => onPreview(item)}
                  title={
                    item.fileUrl
                      ? `预览 ${item.fileName}`
                      : `${item.fileName}（还没上传到云端，编辑后重新选一次文件）`
                  }
                >
                  <svg className="krow__file-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M4.5 2.5h4L12.5 6v7.5h-8z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8.5 2.5V6h4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="krow__file-name">{item.fileName}</span>
                  <span className="krow__file-size">
                    {formatFileSize(item.fileSize ?? 0)}
                  </span>
                </button>
              )}

              {item.url && (
                <a className="krow__link" href={item.url} target="_blank" rel="noreferrer noopener">
                  打开链接 ↗
                </a>
              )}
            </span>
          </span>

          <span className="row__actions">
            <ConfirmDelete label="删除" onConfirm={() => onRemove(item.id)} />
          </span>
        </li>
      ))}
    </ul>
  )
}
