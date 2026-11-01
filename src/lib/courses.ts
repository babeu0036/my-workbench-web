import type { Course, CourseWeeks } from './types'

/** 课程表一共 12 节 */
export const MAX_PERIOD = 12
/** 周次上限。一学期 20 周够了，超出当坏数据 */
export const MAX_WEEK = 20
/** 没填周次范围时的默认值，跟学校的常规学期一致 */
export const DEFAULT_WEEK_START = 1
export const DEFAULT_WEEK_END = 16

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const WEEKDAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
] as const

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday - 1] ?? ''
}

/** 3-4 节 / 第 5 节 */
export function periodLabel(start: number, end: number): string {
  return start === end ? `第 ${start} 节` : `${start}-${end} 节`
}

/** 1-16 周 · 单周 / 第 3 周 */
export function weeksText(course: Course): string {
  const range =
    course.weekStart === course.weekEnd
      ? `第 ${course.weekStart} 周`
      : `${course.weekStart}-${course.weekEnd} 周`
  if (course.weeks === 'odd') return `${range} · 单周`
  if (course.weeks === 'even') return `${range} · 双周`
  return range
}

/**
 * 2026-09-01 → 那天的本地零点；格式不对给 null。
 * 解析完再回读一次年月日：`new Date(2026, 12, 1)` 会悄悄滚到 2027 年，
 * 不核对就等于认下了「13 月」这种值。
 */
function parseKey(key: string): number | null {
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null
  }
  return date.getTime()
}

/**
 * 今天是学期第几周：floor((今天 - 学期开始) / 7) + 1。
 * 两个都用「本地零点」算，跨月、跨年、夏令时都不会差一天。
 * 没填学期开始（或日期坏了）返回 null —— 这时单双周和周次范围都算不出来。
 */
export function weekNumberOf(semesterStart: string, now: number = Date.now()): number | null {
  const start = parseKey(semesterStart)
  if (start === null) return null

  const d = new Date(now)
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.floor(Math.round((today - start) / MS_PER_DAY) / 7) + 1
}

/**
 * 这门课在某一周上不上。
 * weekNo 为 null（没设学期开始）时一律返回 true：算不出来就不灰，
 * 免得整张表莫名其妙全变灰。
 */
export function isActiveInWeek(course: Course, weekNo: number | null): boolean {
  if (weekNo === null) return true
  if (weekNo < course.weekStart || weekNo > course.weekEnd) return false
  if (course.weeks === 'odd') return weekNo % 2 === 1
  if (course.weeks === 'even') return weekNo % 2 === 0
  return true
}

/** 这周不上课的原因，详情里写给人看。上得上的返回 '' */
export function inactiveReason(course: Course, weekNo: number | null): string {
  if (weekNo === null || isActiveInWeek(course, weekNo)) return ''
  if (weekNo < course.weekStart) return `第 ${course.weekStart} 周才开始`
  if (weekNo > course.weekEnd) return `第 ${course.weekEnd} 周已经结课`

  // 只剩单双周对不上这一种
  const parity = weekNo % 2 === 1 ? '单' : '双'
  const need = course.weeks === 'odd' ? '单' : '双'
  return `这周是第 ${weekNo} 周（${parity}周），这门课只上${need}周`
}

function toInt(value: unknown, fallback = 0): number {
  const n =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function normalizeWeeks(value: unknown): CourseWeeks {
  return value === 'odd' || value === 'even' ? value : 'all'
}

function nextId(list: Course[], now: number = Date.now()): number {
  const max = list.reduce((acc, item) => (item.id > acc ? item.id : acc), 0)
  return now > max ? now : max + 1
}

/**
 * 读盘时补一遍：坏条目直接丢掉（课表里画不出半条课），
 * 缺的周次补成 1-16，单双周不认识的当「每周」。
 */
export function normalizeCourses(value: unknown): Course[] {
  if (!Array.isArray(value)) return []

  const out: Course[] = []
  const used = new Set<number>()

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>

    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const weekday = toInt(item.weekday)
    const startPeriod = toInt(item.startPeriod)
    const endPeriod = toInt(item.endPeriod)
    if (!name) continue
    if (weekday < 1 || weekday > 7) continue
    if (startPeriod < 1 || startPeriod > MAX_PERIOD) continue
    if (endPeriod < startPeriod || endPeriod > MAX_PERIOD) continue

    const weekStart = clamp(toInt(item.weekStart, DEFAULT_WEEK_START), 1, MAX_WEEK)
    const weekEnd = clamp(toInt(item.weekEnd, DEFAULT_WEEK_END), weekStart, MAX_WEEK)

    let id = toInt(item.id)
    if (id <= 0 || used.has(id)) {
      id = out.reduce((acc, course) => (course.id > acc ? course.id : acc), 0) + 1
      while (used.has(id)) id += 1
    }
    used.add(id)

    const location = typeof item.location === 'string' ? item.location.trim() : ''
    const subjectId = typeof item.subjectId === 'string' ? item.subjectId : ''

    out.push({
      id,
      name,
      weekday,
      startPeriod,
      endPeriod,
      weeks: normalizeWeeks(item.weeks),
      weekStart,
      weekEnd,
      ...(location ? { location } : {}),
      ...(subjectId ? { subjectId } : {}),
    })
  }

  return out
}

/** 加一门课。id 由这里统一发，页面不用管 */
export function addCourse(list: Course[], draft: Omit<Course, 'id'>, now: number = Date.now()): Course[] {
  return [...list, { ...draft, id: nextId(list, now) }]
}

export function removeCourse(list: Course[], id: number): Course[] {
  return list.filter(course => course.id !== id)
}

/** 存在性判断，导入去重和测试都会用 */
export function hasSameCourse(list: Course[], draft: Omit<Course, 'id'>): boolean {
  return list.some(
    course =>
      course.name === draft.name &&
      course.weekday === draft.weekday &&
      course.startPeriod === draft.startPeriod &&
      course.endPeriod === draft.endPeriod,
  )
}

/** 按周几、节次排；不改原数组 */
export function sortCourses(list: Course[]): Course[] {
  return [...list].sort(
    (a, b) =>
      a.weekday - b.weekday ||
      a.startPeriod - b.startPeriod ||
      a.endPeriod - b.endPeriod ||
      a.id - b.id,
  )
}

/** 某一天有哪些课，已排好序 */
export function coursesOfDay(list: Course[], weekday: number): Course[] {
  return sortCourses(list.filter(course => course.weekday === weekday))
}

export type ParseError = { line: number; message: string }
export type ParseResult = { courses: Omit<Course, 'id'>[]; errors: ParseError[] }

const CN_NUM = ['一', '二', '三', '四', '五', '六', '日']

/** 周一 / 星期一 / 周1 → 1；周日 / 周天 / 星期天 → 7；认不出给 0 */
function parseWeekday(token: string): number {
  const m = token.match(/^(?:周|星期|礼拜)?([一二三四五六日天1-7])$/)
  if (!m) return 0
  const char = m[1] === '天' ? '日' : m[1]
  const index = CN_NUM.indexOf(char)
  return index >= 0 ? index + 1 : Number(char)
}

/** 1-2 / 3 / 第1-2节 → [1,2] */
function parsePeriod(token: string): [number, number] | null {
  const m = token.replace(/^第/, '').replace(/节$/, '').match(/^(\d{1,2})(?:[-~—](\d{1,2}))?$/)
  if (!m) return null
  const start = Number(m[1])
  const end = m[2] ? Number(m[2]) : start
  if (start < 1 || start > MAX_PERIOD) return null
  if (end < start || end > MAX_PERIOD) return null
  return [start, end]
}

/** 1-16 / 1-16单 / 1-16双 / 5 → 周次范围 + 单双周 */
function parseWeeks(token: string): { start: number; end: number; weeks: CourseWeeks } | null {
  const m = token.match(/^(\d{1,2})(?:[-~—](\d{1,2}))?(单|双)?$/)
  if (!m) return null
  const start = Number(m[1])
  const end = m[2] ? Number(m[2]) : start
  if (start < 1 || end < start || end > MAX_WEEK) return null
  const weeks: CourseWeeks = m[3] === '单' ? 'odd' : m[3] === '双' ? 'even' : 'all'
  return { start, end, weeks }
}

/**
 * 一行一门课：名称 周几 节次 周次 [地点]
 * 地点放最后，是因为它最可能带空格（「3-201 机房」）；
 * 名称、周几、节次、周次都不能带空格，切出来正好四段。
 */
function parseLine(line: string): Omit<Course, 'id'> | string {
  const parts = line.split(/\s+/)
  if (parts.length < 4) return '至少要有「名称 周几 节次 周次」四项'

  const [name, weekdayText, periodText, weekText] = parts
  const location = parts.slice(4).join(' ')

  const weekday = parseWeekday(weekdayText)
  if (!weekday) return `认不出「${weekdayText}」，周几要写成周一…周日`

  const period = parsePeriod(periodText)
  if (!period) return `认不出「${periodText}」，节次要写成 1-2（第 1 到 12 节）`

  const weeks = parseWeeks(weekText)
  if (!weeks) return `认不出「${weekText}」，周次要写成 1-16 / 1-16单 / 1-16双`

  return {
    name,
    weekday,
    startPeriod: period[0],
    endPeriod: period[1],
    weeks: weeks.weeks,
    weekStart: weeks.start,
    weekEnd: weeks.end,
    ...(location ? { location } : {}),
  }
}

/**
 * 粘贴文本 → 课程列表。
 * 空行跳过（不算错）；解析失败的行一律记下来，带行号，不静默丢。
 */
export function parseCourseText(text: string): ParseResult {
  const courses: Omit<Course, 'id'>[] = []
  const errors: ParseError[] = []

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim()
    if (!line) return

    const parsed = parseLine(line)
    if (typeof parsed === 'string') {
      errors.push({ line: index + 1, message: `第 ${index + 1} 行格式不对：${parsed}` })
      return
    }
    courses.push(parsed)
  })

  return { courses, errors }
}
