import { dayKey, dayKeyOffset } from './date'
import type { FeedCache, FeedItem } from './types'

/**
 * 行业动态：从两个 RSS 源各取 10 条，合并成一份列表。
 *
 * 浏览器不能直接抓 RSS（跨域），所以统一走 rss2json 这个中转：
 * 它把 XML 转成 JSON，`status === 'ok'` 时 `items` 里就是条目。
 *
 * 这里全是纯函数（除了 fetchFeed 那一个），能单独跑测试，不碰 localStorage。
 * 缓存新鲜度一律按本机时间算 —— 缓存会跟着云同步跑到别的设备，
 * 但那台设备的「24 小时」得由它自己的钟决定。
 */

/** 每个源取前几条 */
export const FEED_PER_SOURCE = 10

/** 缓存活多久：24 小时。超过就重拉 */
export const FEED_TTL = 24 * 60 * 60 * 1000

export type FeedSource = {
  key: string
  /** 列表里显示的来源名 */
  name: string
  url: string
}

export const FEED_SOURCES: FeedSource[] = [
  { key: 'infoq', name: 'InfoQ', url: 'https://www.infoq.cn/feed' },
  { key: 'oschina', name: '开源中国', url: 'https://www.oschina.net/news/rss' },
]

/** 拉取状态：loading 转圈 / ok 正常 / stale 有旧内容但这次失败 / error 什么都没有 */
export type FeedStatus = 'loading' | 'ok' | 'stale' | 'error'

/** 中转地址。源地址要 encode，否则带 query 的 feed 会把它自己的参数混进来 */
export function proxyUrl(sourceUrl: string): string {
  return `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(sourceUrl)}`
}

/**
 * 把源里的时间转成时间戳，认不出来返回 0。
 *
 * rss2json 给的是 `2026-11-08 10:00:00` 这种空格分隔的格式，
 * Safari 直接 `new Date()` 会拿到 Invalid Date，得先换成 ISO 的 T。
 */
export function parseFeedTime(value: string): number {
  const text = value.trim()
  if (!text) return 0

  const fixed = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(text)
    ? text.replace(' ', 'T')
    : text
  const ts = Date.parse(fixed)
  return Number.isFinite(ts) ? ts : 0
}

/**
 * 解析一个源返回的 JSON。
 *
 * 只要 `status === 'ok'` 且 `items` 是数组；逐条挑 title / link / pubDate，
 * **缺一项就丢掉那一条** —— 没有链接的条目点不开，留着只是占地方。
 * 时间解析不出来（0）的也留着：显示成空时间，总比整条消失好。
 */
export function parseFeedJson(
  raw: unknown,
  source: string,
  limit = FEED_PER_SOURCE,
): FeedItem[] {
  if (!raw || typeof raw !== 'object') return []
  const data = raw as { status?: unknown; items?: unknown }
  if (data.status !== 'ok' || !Array.isArray(data.items)) return []

  const out: FeedItem[] = []
  data.items.forEach(entry => {
    if (out.length >= limit) return
    if (!entry || typeof entry !== 'object') return
    const item = entry as Partial<FeedItem>

    const title = typeof item.title === 'string' ? item.title.trim() : ''
    const link = typeof item.link === 'string' ? item.link.trim() : ''
    if (!title || !/^https?:\/\//i.test(link)) return

    out.push({
      title,
      link,
      source,
      pubDate: typeof item.pubDate === 'string' ? item.pubDate.trim() : '',
    })
  })

  return out
}

/** 两个源拼一起 → 按链接去重 → 新的在上。同一秒发的保持原顺序 */
export function mergeFeed(lists: FeedItem[][]): FeedItem[] {
  const seen = new Set<string>()
  const out: FeedItem[] = []

  lists.forEach(list => {
    list.forEach(item => {
      if (seen.has(item.link)) return
      seen.add(item.link)
      out.push(item)
    })
  })

  return out.sort((a, b) => parseFeedTime(b.pubDate) - parseFeedTime(a.pubDate))
}

/**
 * 缓存还能不能用。
 *
 * 空缓存不算新鲜（哪怕 fetchedAt 是刚才）；本机时间被调回过去时按新鲜算，
 * 否则每次打开都要重拉一遍。
 */
export function isFresh(cache: FeedCache, now: number = Date.now()): boolean {
  if (!cache.fetchedAt || cache.items.length === 0) return false
  const diff = now - cache.fetchedAt
  return diff < 0 || diff < FEED_TTL
}

/** 一条条目从存储 / 云端回来时的校验；认不出来返回 null */
function normalizeFeedItem(raw: unknown): FeedItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<FeedItem>

  const title = typeof item.title === 'string' ? item.title.trim() : ''
  const link = typeof item.link === 'string' ? item.link.trim() : ''
  if (!title || !/^https?:\/\//i.test(link)) return null

  return {
    title,
    link,
    source: typeof item.source === 'string' ? item.source.trim() : '',
    pubDate: typeof item.pubDate === 'string' ? item.pubDate.trim() : '',
  }
}

/**
 * 读盘兜底。fetchedAt 不合法就当 0（等于过期，下次进去会重拉），
 * 坏条目一条条剔掉；整体不合法就是一份空缓存。
 */
export function normalizeFeedCache(raw: unknown): FeedCache {
  const empty: FeedCache = { fetchedAt: 0, items: [] }
  if (!raw || typeof raw !== 'object') return empty
  const data = raw as Partial<FeedCache>

  const fetchedAt =
    typeof data.fetchedAt === 'number' && Number.isFinite(data.fetchedAt) && data.fetchedAt > 0
      ? data.fetchedAt
      : 0

  const items = Array.isArray(data.items)
    ? data.items
        .map(normalizeFeedItem)
        .filter((item): item is FeedItem => item !== null)
    : []

  return { fetchedAt, items }
}

/**
 * 拉两个源。单个源失败不影响另一个；两个都挂（或者一个条都没解析出来）才抛错 ——
 * 页面据此决定是「显示上次内容」还是「暂时拉不到」。
 *
 * 用 allSettled 而不是 all：一个源挂了不该把另一个已经拿到的内容一起扔掉。
 */
export async function fetchFeed(): Promise<FeedItem[]> {
  const results = await Promise.allSettled(
    FEED_SOURCES.map(async source => {
      const res = await fetch(proxyUrl(source.url), { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`${source.name} ${res.status}`)
      const json: unknown = await res.json()
      return parseFeedJson(json, source.name)
    }),
  )

  const lists: FeedItem[][] = []
  let failed = 0
  results.forEach(result => {
    if (result.status === 'fulfilled') lists.push(result.value)
    else failed += 1
  })

  const items = mergeFeed(lists)
  if (failed === FEED_SOURCES.length || items.length === 0) {
    throw new Error('行业动态暂时拉不到')
  }
  return items
}

/** 缓存里最新一条的时间，表头显示「更新于 …」用 */
export function formatFetchedAt(ts: number, now: number = Date.now()): string {
  if (!ts) return ''
  const today = dayKey(now)
  const day = dayKey(ts)
  const clock = clockOf(ts)

  if (day === today) return `更新于 ${clock}`
  if (day === dayKeyOffset(today, -1)) return `更新于 昨天 ${clock}`
  return `更新于 ${shortDay(ts, now)} ${clock}`
}

/**
 * 每条右边的时间：今天 / 昨天只写时分，今年写 11.06，跨年才带年份。
 * 认不出时间就空着，不编。
 */
export function formatFeedTime(pubDate: string, now: number = Date.now()): string {
  const ts = parseFeedTime(pubDate)
  if (!ts) return ''

  const today = dayKey(now)
  const day = dayKey(ts)
  const clock = clockOf(ts)

  if (day === today) return `今天 ${clock}`
  if (day === dayKeyOffset(today, -1)) return `昨天 ${clock}`
  return shortDay(ts, now)
}

/** 11.06；不是今年就 2025.11.06 */
function shortDay(ts: number, now: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return d.getFullYear() === new Date(now).getFullYear()
    ? `${mm}.${dd}`
    : `${d.getFullYear()}.${mm}.${dd}`
}

function clockOf(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
