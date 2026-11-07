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
  /**
   * 提交时把「要写进哪个周期」一起带出去；周期是新建的也一并带出去。
   * 传 null 表示先不归周期（目标页会放到「未分组」）。
   */
  onSubmit: (text: string, period: GoalPeriod | null) => void
}

const samePeriod = (a: GoalPeriod, b: { title: string; start: string; end: string }) =>
  a.title === b.title && a.start === b.start && a.end === b.end

/**
 * 添加目标的面板（目标页「+ 添加目标」打开）。
 *
 * 一行文字就能加 —— 周期不是必选项。有现成周期就默认挂在当前那个下面，
 * 想换点一下；一个周期都没有、或者不想归，选「先不归周期」就放进「未分组」，
 * 之后随时还能再归。以前这里卡着「先建周期才能加」，等于为了记一句话先填三个字段。
 *
 * 周期仍然只来自两处：已经建过的（已结束的不列）、自己定一个（名字 + 起止）。
 * 没有「本周 / 本月 / 本学期 / 暑假 / 寒假」那排按日历自动切的快捷格。
 */
export default function GoalAddPanel({ periods, onClose, onSubmit }: Props) {
  const [text, setText] = useState('')
  // null = 先不归周期；有数字 = 挂在那个周期下
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const active = activePeriod(periods)
    if (active) return active.id
    const upcoming = sortPeriods(periods).find(period => periodState(period) !== 'past')
    return upcoming?.id ?? null
  })

  /** 现有周期：已经结束的不列 */
  const pickable = sortPeriods(periods).filter(period => periodState(period) !== 'past')
  const [formOpen, setFormOpen] = useState(false)
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

  // 表单开着就提交表单里的周期（没填完就是 null = 不归周期），否则提交选中的那个
  const period = formOpen ? customPeriod : (periods.find(item => item.id === selectedId) ?? null)
  const canSubmit = text.trim().length > 0

  function submit() {
    if (!canSubmit) return
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

        <span className="sheet__label">放在哪个周期（可以不选）</span>

        <div className="sheet__pills">
          {pickable.map(item => {
            const on = !formOpen && selectedId === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={on ? 'choice choice--on' : 'choice'}
                onClick={() => {
                  setSelectedId(item.id)
                  setFormOpen(false)
                }}
                aria-pressed={on}
                title={periodRangeText(item)}
              >
                {item.title}
              </button>
            )
          })}

          <button
            type="button"
            className={!formOpen && selectedId === null ? 'choice choice--on' : 'choice'}
            onClick={() => {
              setSelectedId(null)
              setFormOpen(false)
            }}
            aria-pressed={!formOpen && selectedId === null}
          >
            先不归周期
          </button>
        </div>

        <button
          type="button"
          className={formOpen ? 'period-new period-new--on' : 'period-new'}
          onClick={() => setFormOpen(open => !open)}
          aria-expanded={formOpen}
        >
          {formOpen ? '收起，用上面的选择' : '+ 自己定一个周期'}
        </button>

        {formOpen && (
          <>
            <span className="sheet__label">新周期（起止不填就是先不归）</span>

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
            : '会先放在「未分组」，之后想归到哪个周期都行'}
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
