import ConfirmDelete from './ConfirmDelete'
import { typeLabel } from '../lib/knowledge'
import { formatFileSize } from '../lib/files'
import type { Knowledge } from '../lib/types'

type Props = {
  /** 已经筛过、排过序的记录，这个组件不再动数据 */
  items: Knowledge[]
  onEdit: (id: number) => void
  onRemove: (id: number) => void
  /** 打开附件：文件本体在 IndexedDB，取文件、开窗口这些副作用交给页面 */
  onOpenFile: (item: Knowledge) => void
}

/**
 * 知识库列表：一条一块，类型标签 + 标题同一行，下面是那句话。
 *
 * 点标签 / 标题 / 说明那一整块进编辑，链接和附件单独做成可点元素 ——
 * 放在同一个按钮里的话，点「打开文件」会先触发编辑面板，等于点不开。
 * 删除走 ConfirmDelete（原地变「确定 / 取消」），不用 window.confirm。
 *
 * 附件显示文件名和大小：换台设备同步过来时文件不在本机，
 * 名字还在也便于知道原本挂的是什么。
 */
export default function KnowledgeList({ items, onEdit, onRemove, onOpenFile }: Props) {
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
                <span className={`ktag ktag--${item.type}`}>{typeLabel(item.type)}</span>
                <span className="row__text krow__title">{item.title}</span>
              </span>
              <span className="krow__summary">{item.summary}</span>
            </button>

            <span className="krow__sources">
              {item.attachment && (
                <button
                  type="button"
                  className="krow__file"
                  onClick={() => onOpenFile(item)}
                  title={`打开 ${item.attachment.name}`}
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
                  <span className="krow__file-name">{item.attachment.name}</span>
                  <span className="krow__file-size">{formatFileSize(item.attachment.size)}</span>
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
