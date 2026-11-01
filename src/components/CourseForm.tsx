import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_WEEK_END,
  DEFAULT_WEEK_START,
  MAX_PERIOD,
  MAX_WEEK,
  WEEKDAY_OPTIONS,
} from '../lib/courses'
import type { Course, CourseWeeks, Subject } from '../lib/types'

type Props = {
  subjects: Subject[]
  /** 今天周几，1-7。新建时默认落在今天 */
  today: number
  /**
   * 从网格的空格子点进来时带的预填值：周几和那一节。
   * 没带（右下角 + 打开）就落在今天、第 1-2 节。
   */
  seed?: { weekday: number; startPeriod: number }
  onClose: () => void
  onAdd: (draft: Omit<Course, 'id'>) => void
}

const PERIODS = Array.from({ length: MAX_PERIOD }, (_, i) => i + 1)

const WEEK_OPTIONS: { value: CourseWeeks; label: string }[] = [
  { value: 'all', label: '每周' },
  { value: 'odd', label: '单周' },
  { value: 'even', label: '双周' },
]

/**
 * 添加课程的面板。
 * 课程名 + 周几 + 节次是必填的，周次范围默认 1-16（改错了会提示），
 * 地点和科目可以不填 —— 一节「自习」也能排进表里。
 */
export default function CourseForm({ subjects, today, seed, onClose, onAdd }: Props) {
  const [name, setName] = useState('')
  const [weekday, setWeekday] = useState(seed?.weekday ?? today)
  const [startPeriod, setStartPeriod] = useState(seed?.startPeriod ?? 1)
  // 从格子进来时先按单节填，连堂课把结束节往下拉一格就行
  const [endPeriod, setEndPeriod] = useState(seed?.startPeriod ?? 2)
  const [weeks, setWeeks] = useState<CourseWeeks>('all')
  // 周次存成字符串再解析：清空输入框时不会立刻变成 0 把提示顶出来
  const [weekStartText, setWeekStartText] = useState(String(DEFAULT_WEEK_START))
  const [weekEndText, setWeekEndText] = useState(String(DEFAULT_WEEK_END))
  const [location, setLocation] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => nameRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const weekStart = Number(weekStartText)
  const weekEnd = Number(weekEndText)

  function submit() {
    if (!name.trim()) {
      setError('先写课程名')
      return
    }
    if (
      !Number.isInteger(weekStart) ||
      !Number.isInteger(weekEnd) ||
      weekStart < 1 ||
      weekEnd > MAX_WEEK ||
      weekEnd < weekStart
    ) {
      setError(`周次范围要在 1-${MAX_WEEK} 之间，结束周不能小于开始周`)
      return
    }

    onAdd({
      name: name.trim(),
      weekday,
      startPeriod,
      endPeriod,
      weeks,
      weekStart,
      weekEnd,
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(subjectId ? { subjectId } : {}),
    })
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="添加课程">
        <div className="sheet__head">
          <span className="sheet__title">添加课程</span>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="收起">
            ×
          </button>
        </div>

        <input
          ref={nameRef}
          className="input"
          value={name}
          onChange={e => {
            setName(e.target.value)
            setError('')
          }}
          placeholder="课程名，比如 高数"
          aria-label="课程名"
        />

        <span className="field__label">周几</span>

        <div className="sheet__pills sheet__pills--week" role="radiogroup" aria-label="周几">
          {WEEKDAY_OPTIONS.map(day => {
            const active = day.value === weekday
            return (
              <button
                key={day.value}
                type="button"
                role="radio"
                aria-checked={active}
                className={active ? 'choice choice--on' : 'choice'}
                onClick={() => setWeekday(day.value)}
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
              value={startPeriod}
              onChange={e => {
                const value = Number(e.target.value)
                setStartPeriod(value)
                // 起始节往后挪，结束节跟着走，不留下「3-2 节」这种区间
                if (endPeriod < value) setEndPeriod(value)
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
              value={endPeriod}
              onChange={e => setEndPeriod(Number(e.target.value))}
            >
              {PERIODS.filter(period => period >= startPeriod).map(period => (
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
              aria-checked={weeks === item.value}
              className={weeks === item.value ? 'seg__btn seg__btn--active' : 'seg__btn'}
              onClick={() => setWeeks(item.value)}
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
              value={weekStartText}
              onChange={e => {
                setWeekStartText(e.target.value)
                setError('')
              }}
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
              value={weekEndText}
              onChange={e => {
                setWeekEndText(e.target.value)
                setError('')
              }}
              aria-label="结束周"
            />
          </label>
        </div>

        <input
          className="input"
          value={location}
          onChange={e => setLocation(e.target.value)}
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
                aria-checked={subjectId === ''}
                className={subjectId === '' ? 'choice choice--on' : 'choice'}
                onClick={() => setSubjectId('')}
              >
                不关联
              </button>
              {subjects.map(subject => {
                const active = subject.id === subjectId
                return (
                  <button
                    key={subject.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={active ? 'choice choice--on' : 'choice'}
                    onClick={() => setSubjectId(subject.id)}
                  >
                    {subject.name}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {error && <p className="form__error">{error}</p>}

        <button type="button" className="btn btn--primary sheet__submit" onClick={submit}>
          添加课程
        </button>
      </div>
    </div>
  )
}
