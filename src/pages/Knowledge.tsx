import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AttachmentPreview from '../components/AttachmentPreview'
import KnowledgeForm from '../components/KnowledgeForm'
import KnowledgeList from '../components/KnowledgeList'
import {
  KNOWLEDGE_TYPES,
  addKnowledge,
  filterKnowledge,
  removeKnowledge,
  sortKnowledge,
  updateKnowledge,
} from '../lib/knowledge'
import type { KnowledgeFilter, KnowledgeInput } from '../lib/knowledge'
import { deleteAttachment } from '../lib/files'
import type { Knowledge } from '../lib/types'

type Props = {
  items: Knowledge[]
  setItems: Dispatch<SetStateAction<Knowledge[]>>
}

/**
 * 知识库。自上而下：标题 → 搜索框 → 类型筛选 → 列表；右下角 + 加一条。
 *
 * 搜索是即时的：每敲一个字就重算，没有「搜索」按钮。搜索和筛选都只活在内存里，
 * 刷新回到「全部」—— 不落盘，也避免某天打开发现「记录不见了」其实是筛选没清。
 *
 * 两种空状态分开写，别混：
 * - 一条都没有：「还没有记录，点右下角添加一条」（点了直接开面板）；
 * - 有记录但筛/搜不出来：「没有匹配的记录」+「清除筛选」。
 *
 * 附件：记录里只存元信息，文件本体在 IndexedDB。点文件名开预览层，
 * 在应用里直接看，不再交给浏览器下载；删记录、换附件时顺手清掉旧文件。
 *
 * 数据在最外层 App，切页不丢；这里只负责筛、排、画。
 */
export default function KnowledgePage({ items, setItems }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<KnowledgeFilter>('all')
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<Knowledge | null>(null)
  const [preview, setPreview] = useState<Knowledge | null>(null)

  const shown = sortKnowledge(filterKnowledge(items, filter, query))

  const filters = [{ key: 'all' as const, label: '全部' }, ...KNOWLEDGE_TYPES]

  function clearFilter() {
    setQuery('')
    setFilter('all')
  }

  function addOne(input: KnowledgeInput) {
    setItems(list => addKnowledge(list, input))
    setPanelOpen(false)
  }

  function removeOne(id: number) {
    const target = items.find(item => item.id === id)
    // 文件删不掉也不拦着删记录，不然一条记录会永远留在列表里
    if (target?.attachment) void deleteAttachment(target.attachment.key)
    setItems(list => removeKnowledge(list, id))
  }

  function saveEdit(input: KnowledgeInput) {
    if (!editing) return
    const oldKey = editing.attachment?.key
    const newKey = input.attachment?.key
    setItems(list => updateKnowledge(list, editing.id, input))
    // 换了文件或把附件去掉了，旧的就没用了
    if (oldKey && oldKey !== newKey) void deleteAttachment(oldKey)
    setEditing(null)
  }

  return (
    <>
      <div className="page page--fab">
        <h2 className="page__title">知识库</h2>

        <input
          className="input kb-search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="搜标题或一句话说明"
          aria-label="搜索知识库"
        />

        <div className="seg seg--wrap" role="group" aria-label="按类型筛选">
          {filters.map(item => (
            <button
              key={item.key}
              type="button"
              aria-pressed={item.key === filter}
              className={item.key === filter ? 'seg__btn seg__btn--active' : 'seg__btn'}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <button type="button" className="kb-empty" onClick={() => setPanelOpen(true)}>
            还没有记录，点右下角添加一条
          </button>
        ) : shown.length === 0 ? (
          <div className="empty-block">
            <p className="empty">没有匹配的记录</p>
            <button type="button" className="btn btn--ghost" onClick={clearFilter}>
              清除筛选
            </button>
          </div>
        ) : (
          <KnowledgeList
            items={shown}
            onEdit={id => setEditing(items.find(item => item.id === id) ?? null)}
            onRemove={removeOne}
            onPreview={item => setPreview(item)}
          />
        )}
      </div>

      <button
        type="button"
        className="fab"
        onClick={() => setPanelOpen(true)}
        aria-label="添加记录"
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {panelOpen && (
        <KnowledgeForm onClose={() => setPanelOpen(false)} onSubmit={addOne} />
      )}

      {editing && (
        <KnowledgeForm
          entry={editing}
          onClose={() => setEditing(null)}
          onSubmit={saveEdit}
        />
      )}

      {preview?.attachment && (
        <AttachmentPreview
          attachment={preview.attachment}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}
