import { useEffect, useRef, useState } from 'react'
import { dayKey } from '../lib/date'
import {
  activePeriod,
  isDateKey,
  nextPeriodId,
  periodPresets,
  periodRangeText,
  periodState,
  sortPeriods,
} from '../lib/goals'
import type { GoalPeriod } from '../lib/types'

type Props = {
  periods: GoalPeriod[]
  /** 课程表里设的学期开始，用来算「本学期」这一格 */
  semesterStart: string
  onClose: () => void
  /** 提交时把「要写进哪个周期」一起带出去；周期是新建的也一并带出去 */
  onSubmit: (text: string, period: GoalPeriod) => void
}

const samePeriod = (a: GoalPeriod, b: { title: string; start: string; end: string }) =>
  a.title === b.title && a.start === b.start && a.end === b.end

/**
 * 添加目标的面板（目标页「+ 添加目标」打开）。
 *
 * 一行文字 + 选周期：先把现有的周期列出来（已结束的不列，那些是历史），
 * 下面一排是五个快捷周期，点了就当选中、提交时才真的建。
 * 「自定义…」展开成名字 + 起止，自己起一个「大二上」「考研冲刺」都行。
 *
 * 周期和目标一起提交：这样不必先建周期再回来写目标，两步变一步。
 */
export default function GoalAddPanel({ periods, semesterStart, onClose, onSubmit }: Props) {
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<GoalPeriod | null>(() => {
    const active = activePeriod(periods)
    if (active) return active
    const upcoming = sortPeriods(periods).find(
      period => periodState(period) !== 'past',
    )
    return upcoming ?? null
  })

  const [customOpen, setCustomOpen] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customStart, setCustomStart] = useState(dayKey())
  const [customEnd, setCustomEnd] = useState('')
  const textRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => textRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  /** 现有周期：已经结束的不列，加目标往过去加没有意义 */
  const pickable = sortPeriods(periods).filter(period => periodState(period) !== 'past')
  // 已经建过的预设不再重复列出来（否则同一行里出现两个「本学期」）
  const presets = periodPresets(semesterStart).filter(
    preset => !periods.some(period => samePeriod(period, preset)),
  )

  function pickPreset(preset: { title: string; start: string; end: string }) {
    const existing = periods.find(period => samePeriod(period, preset))
    // 已有同样名字和日期的周期就直接选中它，不重复建
    setSelected(existing ?? { id: nextPeriodId(periods), ...preset })
    setCustomOpen(false)
  }

  function applyCustom() {
    const title = customTitle.trim()
    if (!title || !isDateKey(customStart) || !isDateKey(customEnd)) return
    const [start, end] =
      customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart]
    const existing = periods.find(period => samePeriod(period, { title, start, end }))
    setSelected(existing ?? { id: nextPeriodId(periods), title, start, end })
    setCustomOpen(false)
  }

  const canSubmit = text.trim().length > 0 && selected !== null

  function submit() {
    if (!canSubmit || !selected) return
    onSubmit(text.trim(), selected)
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="添加目标">
        <div className="sheet__head">
          <span className="sheet__title">添加目标</span>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="收起">
            ×
          </button>
        </div>

        <input
          ref={textRef}
          className="input"
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') submit()
          }}
          placeholder="想做到什么？比如「把高数下册过一遍」"
          aria-label="目标内容"
          maxLength={120}
        />

        <span className="sheet__label">放在哪个周期</span>

        {pickable.length > 0 && (
          <div className="sheet__pills">
            {pickable.map(period => (
              <button
                key={period.id}
                type="button"
                className={selected?.id === period.id ? 'choice choice--on' : 'choice'}
                onClick={() => {
                  setSelected(period)
                  setCustomOpen(false)
                }}
                aria-pressed={selected?.id === period.id}
              >
                {period.title}
              </button>
            ))}
          </div>
        )}

        <span className="sheet__label">或者新建一个</span>

        <div className="sheet__pills">
          {presets.map(preset => {
            const on = Boolean(selected && samePeriod(selected, preset))
            return (
              <button
                key={preset.key}
                type="button"
                className={on ? 'choice choice--on' : 'choice'}
                onClick={() => pickPreset(preset)}
                aria-pressed={on}
                title={periodRangeText(preset)}
              >
                {preset.title}
              </button>
            )
          })}
          <button
            type="button"
            className={customOpen ? 'choice choice--on' : 'choice'}
            onClick={() => setCustomOpen(open => !open)}
            aria-expanded={customOpen}
          >
            自定义…
          </button>
        </div>

        {customOpen && (
          <div className="periodform">
            <input
              className="input"
              value={customTitle}
              onChange={event => setCustomTitle(event.target.value)}
              placeholder="周期名字：大二上 / 考研冲刺 / 暑假"
              aria-label="周期名字"
              maxLength={20}
            />
            <div className="periodform__dates">
              <label className="periodform__field">
                <span>开始</span>
                <input
                  type="date"
                  className="input"
                  value={customStart}
                  onChange={event => setCustomStart(event.target.value)}
                  aria-label="周期开始"
                />
              </label>
              <label className="periodform__field">
                <span>结束</span>
                <input
                  type="date"
                  className="input"
                  value={customEnd}
                  onChange={event => setCustomEnd(event.target.value)}
                  aria-label="周期结束"
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn--ghost periodform__ok"
              onClick={applyCustom}
              disabled={!customTitle.trim() || !isDateKey(customStart) || !isDateKey(customEnd)}
            >
              用这个周期
            </button>
          </div>
        )}

        <p className="sheet__hint">
          {selected
            ? `会记到「${selected.title}」· ${periodRangeText(selected)}`
            : '还没选周期 —— 先挑一个，或者新建一个'}
        </p>

        <button
          type="button"
          className="btn btn--primary sheet__submit"
          onClick={submit}
          disabled={!canSubmit}
        >
          添加
        </button>
      </div>
    </div>
  )
}
