import { useState } from 'react'
import { formatDateCn, dayKey } from '../lib/date'
import { UNSORTED_TITLE, periodCovers, periodRangeText } from '../lib/goals'
import type { Goal, GoalPeriod } from '../lib/types'

type Props = {
  /** 已经排好序的目标（未完成在前、做完的沉底），这个组件不再排序 */
  goals: Goal[]
  periods: GoalPeriod[]
  onToggle: (id: number) => void
  onUpdate: (id: number, text: string) => void
  onRemove: (id: number) => void
  /** 一条都没有时点空状态做什么 */
  onAdd: () => void
}

/**
 * 目标列表：扁平一列，每条前面挂一个小标签写明它属于哪个周期。
 *
 * 不按周期分组 —— 想找「这学期还有什么没做」时，分组反而要多扫好几行标题。
 * 点正文就地变成输入框改文字（回车保存、Esc 放弃、点别处也算保存），
 * 跟任务行一个手感；周期标签过期了就变灰。
 */
export default function GoalList({ goals, periods, onToggle, onUpdate, onRemove, onAdd }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  function startEdit(goal: Goal) {
    setEditingId(goal.id)
    setDraft(goal.text)
  }

  function commit(id: number) {
    const value = draft.trim()
    if (value) onUpdate(id, value)
    setEditingId(null)
  }

  if (goals.length === 0) {
    return (
      <button type="button" className="goal-empty" onClick={onAdd}>
        还没有目标，点这里添加
      </button>
    )
  }

  return (
    <ul className="list">
      {goals.map(goal => {
        const period = periods.find(item => item.id === goal.periodId)
        // 没有周期就是「未分组」；周期被删了理论上不会有孤儿目标（删周期会连目标一起删）
        const title = period?.title ?? UNSORTED_TITLE
        const past = period ? !periodCovers(period, dayKey()) : false
        const editing = editingId === goal.id

        return (
          <li key={goal.id} className="row row--goal">
            <button
              type="button"
              className={goal.done ? 'check check--on' : 'check'}
              onClick={() => onToggle(goal.id)}
              aria-pressed={goal.done}
              aria-label={goal.done ? `撤销完成：${goal.text}` : `标记完成：${goal.text}`}
            >
              {goal.done ? '✓' : ''}
            </button>

            {editing ? (
              <span className="row__body">
                <input
                  className="input row__input"
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') commit(goal.id)
                    if (event.key === 'Escape') setEditingId(null)
                  }}
                  onBlur={() => commit(goal.id)}
                  aria-label="目标内容"
                  maxLength={120}
                  autoFocus
                />
              </span>
            ) : (
              <button
                type="button"
                className="row__body row__edit"
                onClick={() => startEdit(goal)}
                aria-label={`编辑：${goal.text}`}
              >
                <span className={goal.done ? 'row__text row__text--done' : 'row__text'}>
                  {goal.text}
                </span>
                <span className="row__date goalrow__meta">
                  <span className={past ? 'ptag ptag--past' : 'ptag'}>{title}</span>
                  {period && <span className="goalrow__range">{periodRangeText(period)}</span>}
                  {goal.done && goal.doneAt !== undefined && (
                    <span>· {formatDateCn(dayKey(goal.doneAt))} 完成</span>
                  )}
                </span>
              </button>
            )}

            <span className="row__actions">
              <button
                type="button"
                className="btn btn--ghost btn--danger"
                onClick={() => onRemove(goal.id)}
                aria-label={`删除：${goal.text}`}
              >
                删除
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
