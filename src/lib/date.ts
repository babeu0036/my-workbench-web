const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const MS_PER_DAY = 24 * 60 * 60 * 1000

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
export function daysUntil(dateStr: string, now: number = Date.now()): number {
  const { y, m, d } = parseDate(dateStr)
  if (!y || !m || !d) return Number.NaN

  const target = new Date(y, m - 1, d)
  const base = new Date(now)
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate())

  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY)
}

/** 2026-11-01 → 2026-11-01 周日 */
export function formatDate(dateStr: string): string {
  const { y, m, d } = parseDate(dateStr)
  if (!y || !m || !d) return dateStr
  return `${dateStr} ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`
}

/** 2026-11-01 → 11月1日 周日。任务行空间小，不带年份 */
export function formatDateCn(dateStr: string): string {
  const { y, m, d } = parseDate(dateStr)
  if (!y || !m || !d) return dateStr
  return `${m}月${d}日 ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`
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

/** 本地日期键 2026-10-26。活跃天数和连续天数都按它去重 */
export function dayKey(ts: number = Date.now()): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 从某个日期键往前 / 往后挪几天，负数往前。日期框的「今天 / 明天 / 后天」用它算 */
export function dayKeyOffset(key: string, days: number): string {
  const { y, m, d } = parseDate(key)
  if (!y || !m || !d) return key
  return dayKey(new Date(y, m - 1, d + days).getTime())
}

/**
 * 一周的标识 = 当周周一那天的日期键（如 2026-10-26）。
 * 固定 10 个字符，所以字符串比较就等于时间先后，不用再转回时间戳。
 */
export function weekKeyOf(ts: number = Date.now()): string {
  return dayKey(weekStart(ts))
}

/** 从某个 weekKey 往前 / 往后挪几周，负数往前 */
export function weekKeyOffset(key: string, weeks: number): string {
  const { y, m, d } = parseDate(key)
  if (!y || !m || !d) return key
  // 用年月日重新构造：跨月、跨年、夏令时都不会偏
  return dayKey(new Date(y, m - 1, d + weeks * 7).getTime())
}

/** 一周写成 10.26 - 11.01，让人看得出是哪一周 */
export function formatWeekRange(key: string): string {
  const { y, m, d } = parseDate(key)
  if (!y || !m || !d) return key
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 6)
  const md = (dt: Date) => `${pad(dt.getMonth() + 1)}.${pad(dt.getDate())}`
  return `${md(start)} - ${md(end)}`
}

/**
 * 日期键（2026-11-03）落不落在本周。
 * 截止日期是日期字符串而不是时间戳，这里也用日期键比较：
 * 两个都是 10 个字符，字符串比大小就等于比日期，不用来回转换。
 */
export function isDateKeyInWeek(dateKey: string, now: number = Date.now()): boolean {
  const key = weekKeyOf(now)
  return dateKey >= key && dateKey < weekKeyOffset(key, 1)
}
