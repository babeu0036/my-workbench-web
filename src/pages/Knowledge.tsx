import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AttachmentPreview from '../components/AttachmentPreview'
import FeedPanel from '../components/FeedPanel'
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
import { fetchFeed, isFresh } from '../lib/feed'
import type { FeedStatus } from '../lib/feed'
import { deleteAttachment } from '../lib/files'
import type { FeedCache, FeedItem, Knowledge } from '../lib/types'

type Props = {
  items: Knowledge[]
  setItems: Dispatch<SetStateAction<Knowledge[]>>
  /** 行业动态的缓存，放在 App：切页回来不用重拉 */
  feed: FeedCache
  setFeed: Dispatch<SetStateAction<FeedCache>>
}

/**
 * 知识库。自上而下：标题 → 搜索框 → 类型筛选 →（仅行业动态）今日动态 → 列表；
 * 右下角 + 加一条。
 *
 * 搜索是即时的：每敲一个字就重算，没有「搜索」按钮。搜索和筛选都只活在内存里，
 * 刷新回到「全部」—— 不落盘，也避免某天打开发现「记录不见了」其实是筛选没清。
 *
 * 两种空状态分开写，别混：
 * - 一条都没有：「还没有记录，点右下角添加一条」（点了直接开面板）；
 * - 有记录但筛/搜不出来：「没有匹配的记录」+「清除筛选」。
 *
 * 行业动态：只在选中这一栏时才检查缓存。24 小时内直接用，不发请求；
 * 过期或没有缓存才拉两个 RSS 源。拉失败还有旧内容就照旧显示（标一句「更新失败」），
 * 一条都没有才说「暂时拉不到」。收藏 = 立刻存一条记录 + 打开面板把光标放到说明上，
 * Esc 关掉也不会丢（说明本来就可以空着）。
 *
 * 附件：记录里只存元信息，文件本体在 IndexedDB。点文件名开预览层，
 * 在应用里直接看，不再交给浏览器下载；删记录、换附件时顺手清掉旧文件。
 *
 * 数据在最外层 App，切页不丢；这里只负责筛、排、画。
 */
export default function KnowledgePage({ items, setItems, feed, setFeed }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<KnowledgeFilter>('all')
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<Knowledge | null>(null)
  /** 从行业动态收藏进来的那条，打开面板时焦点落在「一句话说明」 */
  const [focusField, setFocusField] = useState<'title' | 'summary'>('title')
  const [preview, setPreview] = useState<Knowledge | null>(null)

  const [feedStatus, setFeedStatus] = useState<FeedStatus>('loading')
  // 同一时刻只允许一个请求在飞：切页来回点、连点重试都不会发两遍
  const busyRef = useRef(false)

  const shown = sortKnowledge(filterKnowledge(items, filter, query))
  const filters = [{ key: 'all' as const, label: '全部' }, ...KNOWLEDGE_TYPES]

  /** 已经收藏过的链接：同一个链接只放一个「收藏」，省得列表里出现两条一样的 */
  const collected = new Set(
    items.map(item => item.url).filter((url): url is string => Boolean(url)),
  )

  async function loadFeed(force: boolean) {
    if (busyRef.current) return
    // 新鲜就直接用缓存，一个请求都不发
    if (!force && isFresh(feed, Date.now())) {
      setFeedStatus('ok')
      return
    }

    busyRef.current = true
    setFeedStatus('loading')
    try {
      const list = await fetchFeed()
      setFeed({ fetchedAt: Date.now(), items: list })
      setFeedStatus('ok')
    } catch {
      // 有旧内容就继续显示，别让一屏好文章因为一次超时消失
      setFeedStatus(feed.items.length > 0 ? 'stale' : 'error')
    } finally {
      busyRef.current = false
    }
  }

  // 只在切到「行业动态」时检查一次；「重试」按钮走另一条路
  useEffect(() => {
    if (filter === 'industry') void loadFeed(false)
    // loadFeed 每次渲染都是新的，跟着它会把 effect 变成每渲染一次就跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  function clearFilter() {
    setQuery('')
    setFilter('all')
  }

  function addOne(input: KnowledgeInput) {
    setItems(list => addKnowledge(list, input))
    setPanelOpen(false)
  }

  /** 收藏一条动态：立刻入库（说明留空），再把面板打开让人补那句话 */
  function collect(item: FeedItem) {
    const next = addKnowledge(items, {
      title: item.title,
      summary: '',
      url: item.link,
      type: 'industry',
    })
    if (next.length === items.length) return

    const added = next[next.length - 1]
    setItems(next)
    setFocusField('summary')
    setEditing(added)
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
    setFocusField('title')
  }

  /** 手动点列表正文进编辑：焦点还是照惯例落在标题上 */
  function openEdit(id: number) {
    setFocusField('title')
    setEditing(items.find(item => item.id === id) ?? null)
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

        {filter === 'industry' && (
          <FeedPanel
            status={feedStatus}
            items={feed.items}
            fetchedAt={feed.fetchedAt}
            isCollected={link => collected.has(link)}
            onCollect={collect}
            onRetry={() => void loadFeed(true)}
          />
        )}

        {items.length === 0 ? (
          filter === 'industry' ? (
            // 这一栏上面就是今日动态，再说「点右下角添加一条」会让人以为要自己写
            <p className="kb-note">还没有收藏的动态，点上面的「收藏」就会存到这里</p>
          ) : (
            <button type="button" className="kb-empty" onClick={() => setPanelOpen(true)}>
              还没有记录，点右下角添加一条
            </button>
          )
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
            onEdit={openEdit}
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
          focusField={focusField}
          onClose={() => {
            setEditing(null)
            setFocusField('title')
          }}
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
