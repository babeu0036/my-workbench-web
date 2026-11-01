import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { formatWeekRange, weekKeyOf, weekKeyOffset } from '../lib/date'
import { goalOf, saveGoal, settleGoal } from '../lib/goals'
import type { Goal } from '../lib/types'

type Props = {
  goals: Goal[]
  setGoals: Dispatch<SetStateAction<Goal[]>>
}

/**
 * 复盘 · 目标。只放目标，和「数据」是两个独立页面。
 *
 * 时间关系：卡片上是本周目标（weekKey = 本周一），随时能点完成 / 没完成，
 * 点了就锁定；下面输入框写的是下周目标，提前写下周的不会把本周这条结掉。
 */
export default function ReviewGoal({ goals, setGoals }: Props) {
  const [draft, setDraft] = useState('')

  const thisWeekKey = weekKeyOf()
  const nextWeekKey = weekKeyOffset(thisWeekKey, 1)
  const current = goalOf(goals, thisWeekKey)
  const next = goalOf(goals, nextWeekKey)

  function settle(id: number, done: boolean) {
    setGoals(list => settleGoal(list, id, done))
  }

  function save() {
    const value = draft.trim()
    if (!value) return
    // settleBefore 用本周：只收掉更早的旧目标，本周那条留给上面的按钮
    setGoals(list => saveGoal(list, { text: value, weekKey: nextWeekKey, settleBefore: thisWeekKey }))
    setDraft('')
  }

  return (
    <div className="page">
      <h2 className="page__title">目标</h2>
      <p className="page__hint">本周 {formatWeekRange(thisWeekKey)}</p>

      <div className="card goal">
        <div className="goal__head">
          <span className="goal__week">本周目标 · {formatWeekRange(thisWeekKey)}</span>
          {current?.settled && (
            <span className={current.done ? 'goal__state goal__state--done' : 'goal__state'}>
              已记录 · {current.done ? '完成' : '没完成'}
            </span>
          )}
        </div>

        {current ? (
          <>
            <p className="goal__text">{current.text}</p>

            <div className="goal__actions">
              <button
                type="button"
                className={
                  current.settled && current.done
                    ? 'btn btn--ghost goal__btn goal__btn--on'
                    : 'btn btn--ghost goal__btn'
                }
                disabled={current.settled}
                onClick={() => settle(current.id, true)}
              >
                ☑ 完成
              </button>
              <button
                type="button"
                className={
                  current.settled && !current.done
                    ? 'btn btn--ghost goal__btn goal__btn--on'
                    : 'btn btn--ghost goal__btn'
                }
                disabled={current.settled}
                onClick={() => settle(current.id, false)}
              >
                ☐ 没完成
              </button>
            </div>

            <p className="meta">
              {current.settled ? '这周的目标已经记录，不再改判。' : '点了就锁定，这周不再改判。'}
            </p>
          </>
        ) : (
          <p className="goal__empty">
            这周还没写目标。可以在下面写一条下周的，从下周一开始生效。
          </p>
        )}
      </div>

      <label className="goal__label" htmlFor="goal-input">
        下周目标 · {formatWeekRange(nextWeekKey)}
      </label>

      <div className="composer">
        <input
          id="goal-input"
          className="input"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') save()
          }}
          placeholder="下周想完成什么…"
          maxLength={120}
        />
        <button type="button" className="btn btn--primary" onClick={save} disabled={!draft.trim()}>
          保存
        </button>
      </div>

      <p className="meta">
        {next
          ? `下周已记下：${next.text}（再保存会覆盖这条）`
          : '一周只留一条目标；保存时会把更早、还没结算的目标一起结掉。'}
      </p>
    </div>
  )
}
