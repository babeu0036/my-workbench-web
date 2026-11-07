import { useEffect, useRef, useState } from 'react'
import { dayKey } from '../lib/date'
import {
  activePeriod,
  isDateKey,
  nextPeriodId,
  periodRangeText,
  periodState,
  sortPeriods,
} from '../lib/goals'
import type { GoalPeriod } from '../lib/types'

type Props = {
  periods: GoalPeriod[]
  onClose: () => void
  /** 提交时把「要写进哪个周期」一起带出去；周期是新建的也一并带出去 */
  onSubmit: (text: string, period: GoalPeriod) => void
}

const samePeriod = (a: GoalPeriod, b: { title: string; start: string; end: string }) =>
  a.title === b.title && a.start === b.start && a.end === b.end

/**
 * 添加目标的面板（目标页「+ 添加目标」打开）。
 *
 * 一行文字 + 选周期。周期只来自两处：
 * 1. 已经建过的（已结束的不列，往过去加目标没有意义）；
 * 2. 自己定一个 —— 名字、开始、结束，都自己填。
 *
 * 没有「本周 / 本月 / 本学期 / 暑假 / 寒假」那排快捷格了：按日历自动切出来的
 * 周期会在下周凭空冒出个「新目标」，那不是用户定的，是系统替他定的。
 * 现在周期是什么、从哪天到哪天，全由用户说了算，想建几个建几个。
 *
 * 周期和目标一起提交：这样不必先建周期再回来写目标，两步变一步。
 */
export default function GoalAddPanel({ periods, onClose, onSubmit }: Props) {
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<GoalPeriod | null>(() => {
    const active = activePeriod(periods)
    if (active) return active
    const upcoming = sortPeriods(periods).find(period => periodState(period) !== 'past')
    return upcoming ?? null
  })

  /** 现有周期：已经结束的不列 */
  const pickable = sortPeriods(periods).filter(period => periodState(period) !== 'past')
  // 一个可选的周期都没有时，表单直接摊开 —— 不让人先点一次才知道要建周期
  const [formOpen, setFormOpen] = useState(pickable.length === 0)
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

  /**
   * 表单里填的那个周期。名字和起止都齐了才算数；
   * 名字和日期跟已有的完全一样就复用那条，不重复建。
   */
  const customPeriod: GoalPeriod | null = (() => {
    const title = customTitle.trim()
    if (!title || !isDateKey(customStart) || !isDateKey(customEnd)) return null
    const [start, end] =
      customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart]
    return (
      periods.find(period => samePeriod(period, { title, start, end })) ?? {
        id: nextPeriodId(periods),
        title,
        start,
        end,
      }
    )
  })()

  // 表单开着就提交表单里的周期，否则提交选中的那个
  const period = formOpen ? customPeriod : selected
  const canSubmit = text.trim().length > 0 && period !== null

  function submit() {
    if (!canSubmit || !period) return
    onSubmit(text.trim(), period)
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

        {pickable.length > 0 && (
          <>
            <span className="sheet__label">放在哪个周期</span>

            <div className="sheet__pills">
              {pickable.map(item => {
                const on = !formOpen && selected?.id === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={on ? 'choice choice--on' : 'choice'}
                    onClick={() => {
                      setSelected(item)
                      setFormOpen(false)
                    }}
                    aria-pressed={on}
                    title={periodRangeText(item)}
                  >
                    {item.title}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className={formOpen ? 'period-new period-new--on' : 'period-new'}
              onClick={() => setFormOpen(open => !open)}
              aria-expanded={formOpen}
            >
              {formOpen ? '收起，用上面的周期' : '+ 自己定一个周期'}
            </button>
          </>
        )}

        {formOpen && (
          <>
            <span className="sheet__label">{pickable.length > 0 ? '新周期' : '周期'}</span>

            <div className="periodform">
              <input
                className="input"
                value={customTitle}
                onChange={event => setCustomTitle(event.target.value)}
                placeholder="名字：大二上 / 考研冲刺 / 暑假"
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
            </div>
          </>
        )}

        <p className="sheet__hint">
          {period
            ? `会记到「${period.title}」· ${periodRangeText(period)}`
            : formOpen
              ? '周期名字和起止日期都填上，才能添加'
              : '还没选周期 —— 先挑一个，或者自己定一个'}
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
