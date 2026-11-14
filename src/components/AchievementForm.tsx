import { useEffect, useRef, useState } from 'react'
import {
  UNSORTED_STAGE_ID,
  UNSORTED_STAGE_TITLE,
  currentStage,
  sortStages,
  stageRangeText,
} from '../lib/stages'
import type { Stage } from '../lib/types'

type Props = {
  stages: Stage[]
  /** 打开时预选哪个阶段；不传就按当前阶段，再不行就未归类 */
  defaultStageId?: number
  onClose: () => void
  onAdd: (title: string, criteria: string, stageId: number) => void
}

/**
 * 新建里程碑的面板（阶段卡里的「+ 添加里程碑」打开）。只要标题，判断标准可选。
 *
 * 判断标准就是「做到什么程度算成」—— 卡片上会显示成一行灰字，也可以之后在卡里补。
 * 证据不在这儿填：那得等事情真做完了才有东西写。
 *
 * 阶段要选一个：默认是打开它的那个阶段，也可以改，或者先放「未归类」。
 * 里程碑下面挂什么任务不在这儿填 —— 建完在卡片里一条条加，免得一次要填一堆。
 */
export default function AchievementForm({ stages, defaultStageId, onClose, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [criteria, setCriteria] = useState('')
  const [stageId, setStageId] = useState<number>(() => {
    if (defaultStageId !== undefined) return defaultStageId
    const active = currentStage(stages)
    return active ? active.id : UNSORTED_STAGE_ID
  })
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => titleRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const canSubmit = title.trim().length > 0

  function submit() {
    if (!canSubmit) return
    onAdd(title.trim(), criteria.trim(), stageId)
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="添加里程碑">
        <div className="sheet__head">
          <span className="sheet__title">添加里程碑</span>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="收起">
            ×
          </button>
        </div>

        <input
          ref={titleRef}
          className="input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="想做成的一件事，比如「拿下数学建模国赛」"
          aria-label="里程碑名称"
          maxLength={60}
        />

        <input
          className="input"
          value={criteria}
          onChange={e => setCriteria(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="判断标准（可选）：做到什么程度算成"
          aria-label="判断标准"
          maxLength={120}
        />

        <span className="sheet__label">归到哪个阶段</span>

        <div className="sheet__pills">
          {sortStages(stages).map(item => {
            const on = stageId === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={on ? 'choice choice--on' : 'choice'}
                onClick={() => setStageId(item.id)}
                aria-pressed={on}
                title={stageRangeText(item)}
              >
                {item.title}
              </button>
            )
          })}

          <button
            type="button"
            className={stageId === UNSORTED_STAGE_ID ? 'choice choice--on' : 'choice'}
            onClick={() => setStageId(UNSORTED_STAGE_ID)}
            aria-pressed={stageId === UNSORTED_STAGE_ID}
          >
            {UNSORTED_STAGE_TITLE}
          </button>
        </div>

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
