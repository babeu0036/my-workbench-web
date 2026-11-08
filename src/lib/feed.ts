import { dayKey, dayKeyOffset } from './date'
import type { FeedCache, FeedItem } from './types'

/**
 * 行业动态：从 Supabase 的 `feed_items` 表取最新 20 条。
 *
 * 抓 RSS 的活已经挪到服务端（爬虫 + 定时写库），前端只做一次 GET：
 * 表上开了 anon 只读，所以浏览器直接用 publishable key 读，
 * **绝不**把 service_role 那把放进来 —— 它能绕过所有权限。
 *
 * 这里除 `fetchFeed` 之外都是纯函数，能单独跑测试，不碰 localStorage。
 * 缓存新鲜度一律按本机时间算 —— 缓存会跟着云同步跑到别的设备，
 * 但那台设备的「30 分钟」得由它自己的钟决定。
 */

/** 项目地址（只到域名，路径在下面拼） */
export const FEED_URL = 'https://ovoocdjdowiqzkoqxcjg.supabase.co'

/** 可直接暴露给浏览器的 publishable key：只能读，不能写 */
export const FEED_KEY = 'sb_publishable_vWA3KDJibQ9H7rMmjN4wkg_1E2oorh0'

/** 一次取多少条。库里会一直长，列表只显示最近的 */
export const FEED_LIMIT = 20

/** 缓存活多久：30 分钟。超过就重拉 */
export const FEED_TTL = 30 * 60 * 1000

/** 请求超时：10 秒。卡住的请求不如早点失败，让「重试」有用 */
export const FEED_TIMEOUT = 10_000

/** 拉取状态：loading 转圈 / ok 正常 / stale 有旧内容但这次失败 / error 什么都没有 */
export type FeedStatus = 'loading' | 'ok' | 'stale' | 'error'

/** 查表地址。字段名写死，别用 select=* —— 表以后加列也不用跟着改 */
export function feedApiUrl(): string {
  return (
    `${FEED_URL}/rest/v1/feed_items` +
    `?select=title,link,source,pub_date&order=pub_date.desc&limit=${FEED_LIMIT}`
  )
}

/**
 * 把源里的时间转成时间戳，认不出来返回 0。
 *
 * 库里是 `2026-11-07T05:01:17+00:00` 这种 ISO，直接能解析；
 * 顺手兼容 `2026-11-08 10:00:00` 这种空格分隔的（Safari 会当场 Invalid Date），
 * 换成 ISO 的 T 再试一次。
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

/** 同一链接只留第一条，后来的丢掉 —— React 的 key 就是链接，重了整列会报错 */
export function dedupeFeed(list: FeedItem[]): FeedItem[] {
  const seen = new Set<string>()
  const out: FeedItem[] = []

  list.forEach(item => {
    if (seen.has(item.link)) return
    seen.add(item.link)
    out.push(item)
  })

  return out
}

/**
 * 解析表返回的行。
 *
 * 行里叫 `pub_date`，前端统一叫 `pubDate`，在这里换过来；
 * **缺标题或链接就丢掉那一条** —— 没有链接的条目点不开，留着只是占地方。
 * 时间解析不出来（0）的也留着：显示成空时间，总比整条消失好。
 *
 * 顺序不动：SQL 已经按 pub_date 倒序排过，这里只负责去重。
 */
export function parseFeedRows(raw: unknown): FeedItem[] {
  if (!Array.isArray(raw)) return []

  const out: FeedItem[] = []
  raw.forEach(entry => {
    if (!entry || typeof entry !== 'object') return
    const row = entry as {
      title?: unknown
      link?: unknown
      source?: unknown
      pub_date?: unknown
    }

    const title = typeof row.title === 'string' ? row.title.trim() : ''
    const link = typeof row.link === 'string' ? row.link.trim() : ''
    if (!title || !/^https?:\/\//i.test(link)) return

    out.push({
      title,
      link,
      source: typeof row.source === 'string' ? row.source.trim() : '',
      pubDate: typeof row.pub_date === 'string' ? row.pub_date.trim() : '',
    })
  })

  return dedupeFeed(out)
}

/**
 * 缓存还能不能用：只看「上次成功写入的时间 + 30 分钟」。
 *
 * 不再因为「条数是 0」判成过期 —— 表里确实没内容时，成功一次就该安静 30 分钟，
 * 否则每次切到这一栏都要发一遍请求。失败路径不写 fetchedAt，所以不会误缓存空结果。
 *
 * 本机时间被调回过去时按新鲜算，否则每次打开都要重拉一遍。
 */
export function isFresh(cache: FeedCache, now: number = Date.now()): boolean {
  if (!cache.fetchedAt) return false
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
 * 拉一次，10 秒没回来就 abort。
 *
 * 三种都算失败，页面据此决定是「显示上次内容」还是「暂时拉不到」：
 * - 非 2xx（权限、表名写错、5xx）；
 * - 返回的不是数组（比如被网关拦成了错误页）；
 * - 有行但一条都解析不出来（字段名对不上），这时显示「暂无内容」会掩盖真正的毛病。
 *
 * 成功但返回空数组是**正常结果**，交给页面显示「暂无内容」。
 */
export async function fetchFeed(): Promise<FeedItem[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT)

  try {
    const res = await fetch(feedApiUrl(), {
      signal: controller.signal,
      headers: {
        apikey: FEED_KEY,
        Authorization: `Bearer ${FEED_KEY}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`行业动态 ${res.status}`)

    const json: unknown = await res.json()
    if (!Array.isArray(json)) throw new Error('行业动态返回格式不对')

    const items = parseFeedRows(json)
    if (json.length > 0 && items.length === 0) throw new Error('行业动态没有可用的条目')
    return items
  } finally {
    clearTimeout(timer)
  }
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
