const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 把 2026-11-01 拆成年月日（按本地时区，避免时区把日期推错一天） */
function parseDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { y, m, d }
}

/**
 * 距离截止还有几天。
 * 今天截止 = 0，明天 = 1，昨天 = -1。
 * 用两个「本地零点」相减，再取整，跨夏令时也不会差一天。
 */
export function daysUntil(dateStr: string): number {
  const { y, m, d } = parseDate(dateStr)
  if (!y || !m || !d) return Number.NaN

  const target = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY)
}

/** 2026-11-01 → 2026-11-01 周日 */
export function formatDate(dateStr: string): string {
  const { y, m, d } = parseDate(dateStr)
  if (!y || !m || !d) return dateStr
  return `${dateStr} ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`
}

/** 剩余天数 → 给人看的一句话 */
export function daysLabel(days: number): string {
  if (Number.isNaN(days)) return '日期无效'
  if (days < 0) return '已结束'
  return `还剩 ${days} 天`
}

/** 剩余天数 → 颜色档位，给列表上的小胶囊用 */
export function daysTone(days: number): 'over' | 'today' | 'soon' | 'normal' {
  if (Number.isNaN(days) || days < 0) return 'over'
  if (days === 0) return 'today'
  if (days <= 3) return 'soon'
  return 'normal'
}

/** 今天写成 10月27日 周二 */
export function todayLabel(): string {
  const now = new Date()
  return `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}`
}

/**
 * 本周一 00:00 的时间戳（一周从周一算起，跟国内习惯一致）。
 * 用年月日重新构造而不是减毫秒，跨夏令时也不会偏一小时。
 */
export function weekStart(now: number = Date.now()): number {
  const d = new Date(now)
  const offset = (d.getDay() + 6) % 7 // getDay 里周日是 0，换算成「距周一几天」
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset).getTime()
}

/** 本周日 23:59:59.999 之后的那一刻，也就是下周一 00:00（左闭右开） */
export function weekEnd(now: number = Date.now()): number {
  const d = new Date(weekStart(now))
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getTime()
}

/** 这个时间戳是不是落在本周（周一 00:00 起，到下周一 00:00 止） */
export function isThisWeek(ts: number | undefined, now: number = Date.now()): boolean {
  if (typeof ts !== 'number' || Number.isNaN(ts)) return false
  return ts >= weekStart(now) && ts < weekEnd(now)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * 笔记列表上的更新时间：
 * 今天 21:04 / 昨天 09:30 / 10-26 21:04 / 2025-12-01
 */
export function formatUpdatedAt(ts: number): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''

  const now = new Date()
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`

  const msPerDay = 24 * 60 * 60 * 1000
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const thatStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((todayStart - thatStart) / msPerDay)

  if (dayDiff === 0) return `今天 ${hm}`
  if (dayDiff === 1) return `昨天 ${hm}`
  if (d.getFullYear() === now.getFullYear()) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
