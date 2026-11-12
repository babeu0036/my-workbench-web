import { useState } from 'react'
import ConfirmDelete from './ConfirmDelete'
import { formatDateCn, dayKey } from '../lib/date'
import { UNSORTED_STAGE_TITLE, stageCovers, stageRangeText } from '../lib/stages'
import type { Goal, Stage } from '../lib/types'

type Props = {
  /** 已经排好序的目标（未完成在前、做完的沉底），这个组件不再排序 */
  goals: Goal[]
  stages: Stage[]
  onToggle: (id: number) => void
  onUpdate: (id: number, text: string) => void
  onRemove: (id: number) => void
  /** 一条都没有时点空状态做什么 */
  onAdd: () => void
}

/**
 * 目标列表：扁平一列，每条前面挂一个小标签写明它属于哪个阶段。
 *
 * 不按阶段分组 —— 阶段那一层在下面管成就，目标再按阶段分组就重复了。
 * 想找「这学期还有什么没做」时，分组反而要多扫好几行标题。
 * 点正文就地变成输入框改文字（回车保存、Esc 放弃、点别处也算保存），
 * 跟任务行一个手感；阶段过期了就变灰。
 */
export default function GoalList({ goals, stages, onToggle, onUpdate, onRemove, onAdd }: Props) {
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
        const stage = stages.find(item => item.id === goal.stageId)
        // 没有阶段就是「未分组」；阶段被删了理论上不会有孤儿目标（删阶段连成就一起删）
        const title = stage?.title ?? UNSORTED_STAGE_TITLE
        const past = stage ? !stageCovers(stage, dayKey()) : false
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
                  {stage && <span className="goalrow__range">{stageRangeText(stage)}</span>}
                  {goal.done && goal.doneAt !== undefined && (
                    <span>· {formatDateCn(dayKey(goal.doneAt))} 完成</span>
                  )}
                </span>
              </button>
            )}

            <span className="row__actions">
              <ConfirmDelete label="删除" onConfirm={() => onRemove(goal.id)} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}
