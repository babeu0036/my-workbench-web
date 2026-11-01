import { weekdayOf } from './date'
import type { Course, CourseWeeks } from './types'

/** 课程表一共 12 节 */
export const MAX_PERIOD = 12
/** 周次上限。一学期 20 周够了，超出当坏数据 */
export const MAX_WEEK = 20
/** 没填周次范围时的默认值，跟学校的常规学期一致 */
export const DEFAULT_WEEK_START = 1
export const DEFAULT_WEEK_END = 16
/** 没写节次时的默认值：第 1-2 节（两节连上是常态） */
export const DEFAULT_PERIOD_START = 1
export const DEFAULT_PERIOD_END = 2

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

/**
 * 存在性判断，导入去重和测试都会用。
 *
 * 五项全一样才算重复：名称、周几、节次（起 + 止）、周次范围、单双周。
 * 周次必须算进去 —— 同一门课常常拆成两段上（前 1-4 周、后 5-16 周），
 * 只比名称和周几节次的话，后一段会被当成重复丢掉。
 */
export function hasSameCourse(list: Course[], draft: Omit<Course, 'id'>): boolean {
  return list.some(
    course =>
      course.name === draft.name &&
      course.weekday === draft.weekday &&
      course.startPeriod === draft.startPeriod &&
      course.endPeriod === draft.endPeriod &&
      course.weekStart === draft.weekStart &&
      course.weekEnd === draft.weekEnd &&
      course.weeks === draft.weeks,
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

/**
 * 今天上什么，按起始节排序。首页「今天有课」用它。
 *
 * 除了「今天是周几」，还要过一遍这门课这周上不上：今天第 9 周，
 * 双周的课就不该出现在首页 —— 首页不是课程表，没必要把不上的课也列出来。
 * 没设学期开始时 weekNo 是 null，isActiveInWeek 一律返回 true，跟课程表一致。
 */
export function todayCourses(
  list: Course[],
  semesterStart: string,
  now: number = Date.now(),
): Course[] {
  const weekNo = weekNumberOf(semesterStart, now)
  return coursesOfDay(list, weekdayOf(now)).filter(course => isActiveInWeek(course, weekNo))
}

export type ParseError = { line: number; message: string }
export type ParseResult = { courses: Omit<Course, 'id'>[]; errors: ParseError[] }

const CN_NUM = ['一', '二', '三', '四', '五', '六', '日']

/** 只有「周」「第」这种虚词，认不出任何东西，直接丢掉 */
const FILLER = /^(?:周|节|星期|礼拜|第)$/
/** 地点关键词：带这些字的段一律当教室写 */
const LOCATION_WORDS = /楼|室|场|馆|房/

type Range = { start: number; end: number }
type WeeksRange = Range & { weeks: CourseWeeks }

/** 一段文字认出来是什么。number = 看着像数字，但还没定是节次还是周次 */
export type Token =
  | { kind: 'weekday'; value: number }
  | ({ kind: 'period' } & Range)
  | ({ kind: 'weeks' } & WeeksRange)
  | ({ kind: 'number' } & Range)
  | { kind: 'location'; text: string }
  | { kind: 'name'; text: string }

/** 周一 / 星期一 / 周1 → 1；周日 / 周天 / 星期天 → 7；认不出给 0 */
function parseWeekdayToken(token: string): number {
  const m = token.match(/^(?:周|星期|礼拜)([一二三四五六日天1-7])$/)
  if (!m) return 0
  const char = m[1] === '天' ? '日' : m[1]
  const index = CN_NUM.indexOf(char)
  return index >= 0 ? index + 1 : Number(char)
}

/** 1-16周 / 1-16单 / 1-16(双) / 单周 / 双周 / 第3周 → 周次范围 + 单双周 */
function parseWeeksToken(token: string): WeeksRange | null {
  // 只写了单双周、没写范围：按默认 1-16
  const bare = token.match(/^[（(]?(单|双)周?[）)]?$/)
  if (bare) {
    return {
      start: DEFAULT_WEEK_START,
      end: DEFAULT_WEEK_END,
      weeks: bare[1] === '单' ? 'odd' : 'even',
    }
  }

  // 没有「周 / 单 / 双」这些字样的，一律不算周次 —— 否则会把「3-4」抢走
  if (!/周|单|双/.test(token)) return null

  const m = token.match(/^第?(\d{1,2})(?:[-~—](\d{1,2}))?周?[（(]?(单|双)?[）)]?$/)
  if (!m) return null
  const start = Number(m[1])
  const end = m[2] ? Number(m[2]) : start
  if (start < 1 || end < start || end > MAX_WEEK) return null
  const weeks: CourseWeeks = m[3] === '单' ? 'odd' : m[3] === '双' ? 'even' : 'all'
  return { start, end, weeks }
}

/** 第1-2节 / 1-2节 / 第3节 → 明确写成节次的 */
function parsePeriodToken(token: string): Range | null {
  // 只有带「第」「节」才算明确；光一个「1-2」还得交给数字段去分派
  if (!/第|节/.test(token)) return null
  const m = token.match(/^第?(\d{1,2})(?:[-~—](\d{1,2}))?节?$/)
  if (!m) return null
  const start = Number(m[1])
  const end = m[2] ? Number(m[2]) : start
  if (start < 1 || end < start || end > MAX_PERIOD) return null
  return { start, end }
}

/** 1-2 / 3 / 1~2 → 数字段，是节次还是周次等最后再分 */
function parseNumberToken(token: string): Range | null {
  const m = token.match(/^(\d{1,2})(?:[-~—](\d{1,2}))?$/)
  if (!m) return null
  const start = Number(m[1])
  const end = m[2] ? Number(m[2]) : start
  if (start < 1 || end < start) return null
  return { start, end }
}

/** A-101 / B203 / 3-201 / 201 这类像教室号的段 */
function isRoomLike(token: string): boolean {
  if (LOCATION_WORDS.test(token)) return true
  if (/^[A-Za-z]{1,2}-?\d{1,4}$/.test(token)) return true
  if (/^\d{1,2}-\d{3,4}$/.test(token)) return true
  return /^\d{3,4}$/.test(token)
}

/**
 * 一段文字 → 一个 Token。顺序就是优先级，不能乱：
 * 周次在周几前面（「单周」「1-16周」里都带「周」），
 * 明确节次在裸数字前面（「第3节」不该被当成数字段去和周次比跨度），
 * 裸数字在地点前面（「3-201」先被数字规则排除，才轮得到教室号）。
 */
export function classifyToken(token: string): Token | null {
  if (!token || FILLER.test(token)) return null

  const weeks = parseWeeksToken(token)
  if (weeks) return { kind: 'weeks', ...weeks }

  const weekday = parseWeekdayToken(token)
  if (weekday) return { kind: 'weekday', value: weekday }

  const period = parsePeriodToken(token)
  if (period) return { kind: 'period', ...period }

  const number = parseNumberToken(token)
  if (number) return { kind: 'number', ...number }

  if (isRoomLike(token)) return { kind: 'location', text: token }

  return { kind: 'name', text: token }
}

function firstOf<K extends Token['kind']>(tokens: Token[], kind: K): Extract<Token, { kind: K }> | null {
  return (tokens.find(token => token.kind === kind) as Extract<Token, { kind: K }> | undefined) ?? null
}

/**
 * 数字段分派：明确写了的先用，剩下的按跨度分。
 *
 * 两个数字段：跨度小的当节次、跨度大的当周次（一样大时前面的当节次，
 * 因为大家习惯先写节次后写周次）。
 * 一个数字段：值 ≤ 12 且跨度 ≤ 4 当节次，否则当周次 ——「1-2」是节次，
 * 「1-16」值就超 12 了，只能是周次。
 * 一个都没有：节次默认第 1-2 节，周次默认 1-16 每周。
 */
function resolvePosition(
  numbers: Range[],
  explicitPeriod: Range | null,
  explicitWeeks: WeeksRange | null,
): { period: Range; weeks: WeeksRange } {
  let period = explicitPeriod
  let weeks = explicitWeeks

  if (!period && !weeks) {
    if (numbers.length >= 2) {
      const sorted = numbers
        .map((range, index) => ({ range, index }))
        .sort(
          (a, b) =>
            a.range.end - a.range.start - (b.range.end - b.range.start) || a.index - b.index,
        )
      period = sorted[0].range
      weeks = { ...sorted[sorted.length - 1].range, weeks: 'all' }
    } else if (numbers.length === 1) {
      const [only] = numbers
      const span = only.end - only.start
      if (only.start <= MAX_PERIOD && span <= 4) period = only
      else weeks = { ...only, weeks: 'all' }
    }
  } else if (!period && numbers.length > 0) {
    period = numbers[0]
  } else if (!weeks && numbers.length > 0) {
    weeks = { ...numbers[0], weeks: 'all' }
  }

  return {
    period:
      period && period.start >= 1 && period.end <= MAX_PERIOD
        ? period
        : { start: DEFAULT_PERIOD_START, end: DEFAULT_PERIOD_END },
    weeks:
      weeks && weeks.start >= 1 && weeks.end <= MAX_WEEK
        ? weeks
        : { start: DEFAULT_WEEK_START, end: DEFAULT_WEEK_END, weeks: 'all' },
  }
}

/**
 * 一行一门课，**顺序随便**，按内容认：
 * 周几（周一…周日 / 星期X / 礼拜X）、节次（1-2 / 第1-2节 / 1~2）、
 * 周次（1-16 / 1-16周 / 1-16单 / 1-16双 / 单周 / 双周 / (单)）、
 * 地点（带楼/室/场/馆/房，或者 A-101 / 3-201 / 201 这种教室号）、
 * 剩下的当课程名，取第一段。
 *
 * 列之间空格和 Tab 都算分隔（\s 本来就包含它们，也包含全角空格），
 * 中文输入法打出来的全角空格照样能切开。
 */
function parseLine(line: string): Omit<Course, 'id'> | string {
  const tokens: Token[] = []
  for (const part of line.split(/\s+/)) {
    const token = classifyToken(part)
    if (token) tokens.push(token)
  }

  const name = firstOf(tokens, 'name')
  if (!name) return '找不到课程名'

  const weekday = firstOf(tokens, 'weekday')
  if (!weekday) return '找不到周几'

  const numbers: Range[] = []
  let explicitPeriod: Range | null = null
  let explicitWeeks: WeeksRange | null = null
  let location = ''

  for (const token of tokens) {
    if (token.kind === 'number') numbers.push({ start: token.start, end: token.end })
    else if (token.kind === 'period' && !explicitPeriod) {
      explicitPeriod = { start: token.start, end: token.end }
    } else if (token.kind === 'weeks' && !explicitWeeks) {
      explicitWeeks = { start: token.start, end: token.end, weeks: token.weeks }
    } else if (token.kind === 'location' && !location) {
      location = token.text
    }
  }

  const { period, weeks } = resolvePosition(numbers, explicitPeriod, explicitWeeks)

  return {
    name: name.text,
    weekday: weekday.value,
    startPeriod: period.start,
    endPeriod: period.end,
    weeks: weeks.weeks,
    weekStart: weeks.start,
    weekEnd: weeks.end,
    ...(location ? { location } : {}),
  }
}

/**
 * 粘贴文本 → 课程列表。
 * 空行跳过（不算错）；解析失败的行一律记下来，带行号，不静默丢。
 * 行号按原文算（从 1 开始），空行也占一个号 —— 跟用户在编辑器里数的一致。
 */
export function parseCourseText(text: string): ParseResult {
  const courses: Omit<Course, 'id'>[] = []
  const errors: ParseError[] = []

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim()
    if (!line) return

    const parsed = parseLine(line)
    if (typeof parsed === 'string') {
      errors.push({ line: index + 1, message: `第 ${index + 1} 行${parsed}` })
      return
    }
    courses.push(parsed)
  })

  return { courses, errors }
}
