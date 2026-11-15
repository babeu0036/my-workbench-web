import { useEffect, useRef, useState } from 'react'
import {
  UNSORTED_STAGE_ID,
  UNSORTED_STAGE_TITLE,
  currentStage,
  sortStages,
  stageRangeText,
} from '../lib/stages'
import type { MilestoneKind, Stage } from '../lib/types'

type Props = {
  stages: Stage[]
  /** 打开时预选哪个阶段；不传就按当前阶段，再不行就未归类 */
  defaultStageId?: number
  onClose: () => void
  onAdd: (title: string, criteria: string, stageId: number, kind: MilestoneKind) => void
}

/**
 * 新建阶段目标的面板（阶段卡里的「+ 在这个阶段加目标」打开）。只要标题，判断标准可选。
 *
 * 判断标准就是「做到什么程度算成」—— 卡片上会显示成一行灰字，也可以之后在卡里补。
 * 证据不在这儿填：那得等事情真做完了才有东西写。
 *
 * 类型是两选一：职业相关（默认）/ 个人兴趣 —— 后者不进首页的证据进度，
 * 也不进复盘「这周没动的阶段目标」，但照样显示在阶段卡片里。
 *
 * 阶段要选一个：默认是打开它的那个阶段，也可以改，或者先放「未归类」。
 * 阶段目标下面挂什么任务不在这儿填 —— 建完在卡片里一条条加，免得一次要填一堆。
 */
export default function AchievementForm({ stages, defaultStageId, onClose, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [criteria, setCriteria] = useState('')
  const [kind, setKind] = useState<MilestoneKind>('work')
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
    onAdd(title.trim(), criteria.trim(), stageId, kind)
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="添加阶段目标">
        <div className="sheet__head">
          <span className="sheet__title">添加阶段目标</span>
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
          aria-label="阶段目标名称"
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

        <span className="sheet__label">类型</span>

        <div className="sheet__pills">
          {(['work', 'life'] as MilestoneKind[]).map(value => {
            const on = kind === value
            return (
              <button
                key={value}
                type="button"
                className={on ? 'choice choice--on' : 'choice'}
                onClick={() => setKind(value)}
                aria-pressed={on}
              >
                {value === 'work' ? '职业相关' : '个人兴趣'}
              </button>
            )
          })}
        </div>

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
