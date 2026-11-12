import { useEffect, useRef, useState } from 'react'
import { dayKey } from '../lib/date'
import {
  currentStage,
  isDateKey,
  nextStageId,
  stageRangeText,
  stageState,
  sortStages,
} from '../lib/stages'
import type { Stage } from '../lib/types'

type Props = {
  stages: Stage[]
  onClose: () => void
  /**
   * 提交时把「要写进哪个阶段」一起带出去；阶段是新建的也一并带出去。
   * 传 null 表示先不归阶段（目标页会放到「未归类」）。
   */
  onSubmit: (text: string, stage: Stage | null) => void
}

const sameStage = (a: Stage, b: { title: string; startKey: string; endKey: string }) =>
  a.title === b.title && a.startKey === b.startKey && a.endKey === b.endKey

/**
 * 添加目标的面板（目标页「+ 添加目标」打开）。
 *
 * 一行文字就能加 —— 阶段不是必选项。有现成阶段就默认挂在当前那个下面，
 * 想换点一下；一个阶段都没有、或者不想归，选「先不归阶段」就放进「未归类」，
 * 之后随时还能再归。以前这里卡着「先建阶段才能加」，等于为了记一句话先填三个字段。
 *
 * 阶段仍然只来自两处：已经建过的（已结束的不列）、自己定一个（名字 + 起止）。
 * 没有「本周 / 本月 / 本学期」那排按日历自动切的快捷格。
 */
export default function GoalAddPanel({ stages, onClose, onSubmit }: Props) {
  const [text, setText] = useState('')
  // null = 先不归阶段；有数字 = 挂在那个阶段下
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const active = currentStage(stages)
    if (active) return active.id
    const upcoming = sortStages(stages).find(stage => stageState(stage) !== 'past')
    return upcoming?.id ?? null
  })

  /** 现有阶段：已经结束的不列 */
  const pickable = sortStages(stages).filter(stage => stageState(stage) !== 'past')
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
   * 表单里填的那个阶段。名字和起止都齐了才算数；
   * 名字和日期跟已有的完全一样就复用那条，不重复建。
   */
  const customStage: Stage | null = (() => {
    const title = customTitle.trim()
    if (!title || !isDateKey(customStart) || !isDateKey(customEnd)) return null
    const [startKey, endKey] =
      customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart]
    return (
      stages.find(stage => sameStage(stage, { title, startKey, endKey })) ?? {
        id: nextStageId(stages),
        title,
        startKey,
        endKey,
        // 新建的阶段排最后；真实 order 在 addStage 里再算一次
        order: stages.length,
      }
    )
  })()

  // 表单开着就提交表单里的阶段（没填完就是 null = 不归阶段），否则提交选中的那个
  const stage = formOpen ? customStage : (stages.find(item => item.id === selectedId) ?? null)
  const canSubmit = text.trim().length > 0

  function submit() {
    if (!canSubmit) return
    onSubmit(text.trim(), stage)
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

        <span className="sheet__label">放在哪个阶段（可以不选）</span>

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
                title={stageRangeText(item)}
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
            先不归阶段
          </button>
        </div>

        <button
          type="button"
          className={formOpen ? 'stage-new stage-new--on' : 'stage-new'}
          onClick={() => setFormOpen(open => !open)}
          aria-expanded={formOpen}
        >
          {formOpen ? '收起，用上面的选择' : '+ 自己定一个阶段'}
        </button>

        {formOpen && (
          <>
            <span className="sheet__label">新阶段（起止不填就是先不归）</span>

            <div className="stageform">
              <input
                className="input"
                value={customTitle}
                onChange={event => setCustomTitle(event.target.value)}
                placeholder="名字：大二上 / 考研冲刺 / 暑假"
                aria-label="阶段名字"
                maxLength={20}
              />
              <div className="stageform__dates">
                <label className="stageform__field">
                  <span>开始</span>
                  <input
                    type="date"
                    className="input"
                    value={customStart}
                    onChange={event => setCustomStart(event.target.value)}
                    aria-label="阶段开始"
                  />
                </label>
                <label className="stageform__field">
                  <span>结束</span>
                  <input
                    type="date"
                    className="input"
                    value={customEnd}
                    onChange={event => setCustomEnd(event.target.value)}
                    aria-label="阶段结束"
                  />
                </label>
              </div>
            </div>
          </>
        )}

        <p className="sheet__hint">
          {stage
            ? `会记到「${stage.title}」· ${stageRangeText(stage)}`
            : '会先放在「未归类」，之后想归到哪个阶段都行'}
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
