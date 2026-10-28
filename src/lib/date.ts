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
