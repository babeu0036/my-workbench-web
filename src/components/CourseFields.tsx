import type { RefObject } from 'react'
import { DEFAULT_WEEK_END, DEFAULT_WEEK_START, MAX_PERIOD, MAX_WEEK, WEEKDAY_OPTIONS } from '../lib/courses'
import type { Course, CourseWeeks, Subject } from '../lib/types'

/**
 * 一门课的全部字段，表单里那一坨输入控件。
 *
 * 新增课程和编辑课程用的是同一套字段，所以抽到这里受控渲染 ——
 * 两处各写一遍的话，以后加字段（比如教师、备注）一定会漏掉一边。
 *
 * 周次存成字符串再解析：清空输入框时不会立刻变成 0 把提示顶出来。
 */
export type CourseFieldsValue = {
  name: string
  weekday: number
  startPeriod: number
  endPeriod: number
  weeks: CourseWeeks
  weekStartText: string
  weekEndText: string
  location: string
  subjectId: string
}

const PERIODS = Array.from({ length: MAX_PERIOD }, (_, i) => i + 1)

export const WEEK_OPTIONS: { value: CourseWeeks; label: string }[] = [
  { value: 'all', label: '每周' },
  { value: 'odd', label: '单周' },
  { value: 'even', label: '双周' },
]

/**
 * 新建时的空白值。
 * 从格子点进来会带节次：那一格就按单节填（连堂课往下拉一格结束节就行）；
 * 直接点 + 打开则落在第 1-2 节。
 */
export function blankFields(weekday: number, seedPeriod?: number): CourseFieldsValue {
  return {
    name: '',
    weekday,
    startPeriod: seedPeriod ?? 1,
    endPeriod: seedPeriod ?? 2,
    weeks: 'all',
    weekStartText: String(DEFAULT_WEEK_START),
    weekEndText: String(DEFAULT_WEEK_END),
    location: '',
    subjectId: '',
  }
}

/** 编辑时把已有的课摊回表单 */
export function courseToFields(course: Course): CourseFieldsValue {
  return {
    name: course.name,
    weekday: course.weekday,
    startPeriod: course.startPeriod,
    endPeriod: course.endPeriod,
    weeks: course.weeks,
    weekStartText: String(course.weekStart),
    weekEndText: String(course.weekEnd),
    location: course.location ?? '',
    subjectId: course.subjectId ?? '',
  }
}

/**
 * 表单值 → 可以写进列表的一门课。
 * 校验失败返回错误文案（字符串），成功返回对象 —— 两个调用方都靠
 * `typeof === 'string'` 分辨，不用各自再判一遍。
 */
export function fieldsToDraft(value: CourseFieldsValue): Omit<Course, 'id'> | string {
  const name = value.name.trim()
  if (!name) return '先写课程名'

  if (value.endPeriod < value.startPeriod) return '结束节不能小于起始节'

  const weekStart = Number(value.weekStartText)
  const weekEnd = Number(value.weekEndText)
  if (
    !Number.isInteger(weekStart) ||
    !Number.isInteger(weekEnd) ||
    weekStart < 1 ||
    weekEnd > MAX_WEEK ||
    weekEnd < weekStart
  ) {
    return `周次范围要在 1-${MAX_WEEK} 之间，结束周不能小于开始周`
  }

  const location = value.location.trim()
  return {
    name,
    weekday: value.weekday,
    startPeriod: value.startPeriod,
    endPeriod: value.endPeriod,
    weeks: value.weeks,
    weekStart,
    weekEnd,
    ...(location ? { location } : {}),
    ...(value.subjectId ? { subjectId: value.subjectId } : {}),
  }
}

type Props = {
  value: CourseFieldsValue
  onChange: (patch: Partial<CourseFieldsValue>) => void
  /** 只列真科目，未分类那一项是给任务用的 */
  subjects: Subject[]
  /** 打开面板时自动聚焦课程名，由调用方拿着这个 ref */
  nameRef?: RefObject<HTMLInputElement | null>
}

export default function CourseFields({ value, onChange, subjects, nameRef }: Props) {
  return (
    <>
      <input
        ref={nameRef}
        className="input"
        value={value.name}
        onChange={e => onChange({ name: e.target.value })}
        placeholder="课程名，比如 高数"
        aria-label="课程名"
      />

      <span className="field__label">周几</span>

      <div className="sheet__pills sheet__pills--week" role="radiogroup" aria-label="周几">
        {WEEKDAY_OPTIONS.map(day => {
          const active = day.value === value.weekday
          return (
            <button
              key={day.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? 'choice choice--on' : 'choice'}
              onClick={() => onChange({ weekday: day.value })}
            >
              {day.label.replace('周', '')}
            </button>
          )
        })}
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field__label">起始节</span>
          <select
            className="input"
            value={value.startPeriod}
            onChange={e => {
              const start = Number(e.target.value)
              // 起始节往后挪，结束节跟着走，不留下「3-2 节」这种区间
              onChange({ startPeriod: start, endPeriod: Math.max(start, value.endPeriod) })
            }}
          >
            {PERIODS.map(period => (
              <option key={period} value={period}>
                第 {period} 节
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">结束节</span>
          <select
            className="input"
            value={value.endPeriod}
            onChange={e => onChange({ endPeriod: Number(e.target.value) })}
          >
            {PERIODS.filter(period => period >= value.startPeriod).map(period => (
              <option key={period} value={period}>
                第 {period} 节
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="seg" role="radiogroup" aria-label="单双周">
        {WEEK_OPTIONS.map(item => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={value.weeks === item.value}
            className={value.weeks === item.value ? 'seg__btn seg__btn--active' : 'seg__btn'}
            onClick={() => onChange({ weeks: item.value })}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field__label">从第几周</span>
          <input
            className="input"
            type="number"
            min={1}
            max={MAX_WEEK}
            value={value.weekStartText}
            onChange={e => onChange({ weekStartText: e.target.value })}
            aria-label="开始周"
          />
        </label>

        <label className="field">
          <span className="field__label">到第几周</span>
          <input
            className="input"
            type="number"
            min={1}
            max={MAX_WEEK}
            value={value.weekEndText}
            onChange={e => onChange({ weekEndText: e.target.value })}
            aria-label="结束周"
          />
        </label>
      </div>

      <input
        className="input"
        value={value.location}
        onChange={e => onChange({ location: e.target.value })}
        placeholder="地点（可选），比如 3-201"
        aria-label="地点"
      />

      {subjects.length > 0 && (
        <>
          <span className="field__label">关联科目（可选）</span>
          <div className="sheet__pills" role="radiogroup" aria-label="关联科目（可选）">
            <button
              type="button"
              role="radio"
              aria-checked={value.subjectId === ''}
              className={value.subjectId === '' ? 'choice choice--on' : 'choice'}
              onClick={() => onChange({ subjectId: '' })}
            >
              不关联
            </button>
            {subjects.map(subject => {
              const active = subject.id === value.subjectId
              return (
                <button
                  key={subject.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={active ? 'choice choice--on' : 'choice'}
                  onClick={() => onChange({ subjectId: subject.id })}
                >
                  {subject.name}
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
