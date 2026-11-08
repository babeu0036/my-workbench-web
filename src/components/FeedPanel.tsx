import { formatFeedTime, formatFetchedAt } from '../lib/feed'
import type { FeedStatus } from '../lib/feed'
import type { FeedItem } from '../lib/types'

type Props = {
  status: FeedStatus
  items: FeedItem[]
  /** 上次拉成功的时间，表头显示「更新于 12:30」 */
  fetchedAt: number
  /** 这条链接是不是已经收藏过了（有对应记录就显示「已收藏」并禁用） */
  isCollected: (link: string) => boolean
  onCollect: (item: FeedItem) => void
  onRetry: () => void
}

/**
 * 「今日动态」：行业动态筛选下顶在上面的一块。
 *
 * 拉取中不能留白 —— 表头写「正在更新」，列表区写一句提示，
 * 让用户知道是在等，而不是没有内容。
 *
 * 拉失败分两种：有旧内容就照旧列出来，表头标「更新失败，显示上次内容」；
 * 一条都没有才写「暂时拉不到，稍后再试」。两种都可以点「重试」立刻再拉一次，
 * 不用干等 24 小时过期。
 *
 * 标题是普通 <a target="_blank">，点开原文不离开工作台。
 */
export default function FeedPanel({
  status,
  items,
  fetchedAt,
  isCollected,
  onCollect,
  onRetry,
}: Props) {
  const stateText =
    status === 'stale'
      ? '更新失败，显示上次内容'
      : status === 'error'
        ? '暂时拉不到，稍后再试'
        : status === 'loading'
          ? '正在更新'
          : formatFetchedAt(fetchedAt)

  return (
    <section className="feed" aria-label="今日动态">
      <div className="feed__head">
        <span className="feed__title">今日动态</span>
        <span
          className={status === 'stale' || status === 'error' ? 'feed__state feed__state--warn' : 'feed__state'}
        >
          {stateText}
        </span>
        {(status === 'stale' || status === 'error') && (
          <button type="button" className="feed__retry" onClick={onRetry}>
            重试
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="feed__placeholder">
          {status === 'error' ? '暂时拉不到，稍后再试' : '正在更新'}
        </p>
      ) : (
        <ul className="feed__list">
          {items.map(item => {
            const collected = isCollected(item.link)
            return (
              <li key={item.link} className="feed__row">
                <a
                  className="feed__link"
                  href={item.link}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {item.title}
                </a>

                <span className="feed__meta">
                  <span className="feed__source">{item.source}</span>
                  <span className="feed__time">{formatFeedTime(item.pubDate)}</span>
                </span>

                <button
                  type="button"
                  className="feed__collect"
                  onClick={() => onCollect(item)}
                  disabled={collected}
                  aria-label={collected ? `已收藏：${item.title}` : `收藏：${item.title}`}
                >
                  {collected ? '已收藏' : '收藏'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
