import ConfirmDelete from './ConfirmDelete'
import { typeLabel } from '../lib/knowledge'
import type { Knowledge } from '../lib/types'

type Props = {
  /** 已经筛过、排过序的记录，这个组件不再动数据 */
  items: Knowledge[]
  onEdit: (id: number) => void
  onRemove: (id: number) => void
}

/**
 * 知识库列表：一条一块，类型标签 + 标题同一行，下面是那句话。
 *
 * 点标签 / 标题 / 说明那一整块进编辑，链接单独做成 `<a>` ——
 * 放在同一个按钮里的话，点「打开链接」会先触发编辑面板，等于点不开。
 * 删除走 ConfirmDelete（原地变「确定 / 取消」），不用 window.confirm。
 */
export default function KnowledgeList({ items, onEdit, onRemove }: Props) {
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

            {item.url && (
              <a
                className="krow__link"
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                打开链接 ↗
              </a>
            )}
          </span>

          <span className="row__actions">
            <ConfirmDelete label="删除" onConfirm={() => onRemove(item.id)} />
          </span>
        </li>
      ))}
    </ul>
  )
}
