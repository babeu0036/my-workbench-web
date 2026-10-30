import type { Dispatch, SetStateAction } from 'react'
import Deadlines from './Deadlines'
import type { Deadline, PlanSegment } from '../lib/types'

const SEGMENTS: { key: PlanSegment; label: string }[] = [
  { key: 'week', label: '本周' },
  { key: 'deadlines', label: '比赛' },
]

type Props = {
  seg: PlanSegment
  onSegChange: (seg: PlanSegment) => void
  deadlines: Deadline[]
  setDeadlines: Dispatch<SetStateAction<Deadline[]>>
}

/**
 * 计划页两个分段：本周 / 比赛。
 * 今日任务只在首页，这里不重复放一份；本周是「按周看」的视角。
 * 「本周」的课程表和本周任务在第 4 步接进来，比赛直接复用原来的组件。
 */
export default function Plan({ seg, onSegChange, deadlines, setDeadlines }: Props) {
  return (
    <div className="plan">
      <h2 className="page__title">计划</h2>

      <div className="seg" role="group" aria-label="计划分类">
        {SEGMENTS.map(item => (
          <button
            key={item.key}
            type="button"
            aria-pressed={item.key === seg}
            className={item.key === seg ? 'seg__btn seg__btn--active' : 'seg__btn'}
            onClick={() => onSegChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {seg === 'week' ? (
        <div className="empty-block">
          <p className="empty">周一到周日的课程表在第 4 步接进来</p>
          <p className="meta">本周任务和「添加课程」也在那一步一起做</p>
        </div>
      ) : (
        <Deadlines deadlines={deadlines} setDeadlines={setDeadlines} />
      )}
    </div>
  )
}
