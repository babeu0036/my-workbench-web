import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { formatWeekRange, weekKeyOf, weekKeyOffset } from '../lib/date'
import { goalOf, lastTarget, saveGoal, settleGoal } from '../lib/goals'
import { activeDays, streak, weekTotals } from '../lib/stats'
import type { Goal, ReviewBlock, Todo } from '../lib/types'

type Props = {
  block: ReviewBlock
  todos: Todo[]
  goals: Goal[]
  setGoals: Dispatch<SetStateAction<Goal[]>>
}

/**
 * 复盘。一页两块（数据 / 目标），侧边栏的两个二级项只负责滚到对应那块。
 *
 * 时间关系：本周 = weekKeyOf()，展示的是「上周」的目标，
 * 输入框写的是「下周」的目标 —— 所以每周的节奏是
 * 周末写下周、那一周照着做、再下一周回来复盘。
 */
export default function Review({ block, todos, goals, setGoals }: Props) {
  const [draft, setDraft] = useState('')
  const dataRef = useRef<HTMLElement>(null)
  const goalRef = useRef<HTMLElement>(null)

  const thisWeekKey = weekKeyOf()
  const lastWeekKey = weekKeyOffset(thisWeekKey, -1)
  const nextWeekKey = weekKeyOffset(thisWeekKey, 1)

  useEffect(() => {
    const el = block === 'data' ? dataRef.current : goalRef.current
    el?.scrollIntoView({ block: 'start' })
  }, [block])

  const total = weekTotals(todos)
  const active = activeDays(todos)
  const days = streak(todos)

  const target = lastTarget(goals, thisWeekKey)
  const nextGoal = goalOf(goals, nextWeekKey)

  function settle(id: number, done: boolean) {
    setGoals(list => settleGoal(list, id, done))
  }

  function save() {
    const value = draft.trim()
    if (!value) return
    setGoals(list => saveGoal(list, { text: value, weekKey: nextWeekKey, settleBefore: thisWeekKey }))
    setDraft('')
  }

  return (
    <div className="page">
      <h2 className="page__title">复盘</h2>

      <section className="review__section" ref={dataRef} aria-labelledby="review-data">
        <h3 className="review__h2" id="review-data">
          数据
        </h3>

        <div className="stat-grid">
          <div className="stat">
            <span className="stat__num">
              {total.done}
              <span className="stat__sep">/</span>
              {total.total}
            </span>
            <span className="stat__label">本周完成</span>
          </div>
          <div className="stat">
            <span className="stat__num">
              {active}
              <span className="stat__sep">/</span>7
            </span>
            <span className="stat__label">本周活跃</span>
          </div>
          <div className="stat">
            <span className="stat__num">{days}</span>
            <span className="stat__label">连续天数</span>
          </div>
        </div>

        <p className="meta">
          {total.total === 0
            ? '本周还没有任务，去首页加一条再回来看。'
            : '只算本周一 00:00 之后完成的任务；删掉的任务不再计入。'}
        </p>
      </section>

      <section className="review__section" ref={goalRef} aria-labelledby="review-goal">
        <h3 className="review__h2" id="review-goal">
          目标
        </h3>

        <div className="card goal">
          {target ? (
            <>
              <div className="goal__head">
                <span className="goal__week">
                  {target.weekKey === lastWeekKey ? '上周目标' : '上次目标'} ·{' '}
                  {formatWeekRange(target.weekKey)}
                </span>
                {target.settled && (
                  <span className={target.done ? 'goal__state goal__state--done' : 'goal__state'}>
                    已记录 · {target.done ? '完成' : '没完成'}
                  </span>
                )}
              </div>

              <p className="goal__text">{target.text}</p>

              <div className="goal__actions">
                <button
                  type="button"
                  className={
                    target.settled && target.done
                      ? 'btn btn--ghost goal__btn goal__btn--on'
                      : 'btn btn--ghost goal__btn'
                  }
                  disabled={target.settled}
                  onClick={() => settle(target.id, true)}
                >
                  ☑ 完成
                </button>
                <button
                  type="button"
                  className={
                    target.settled && !target.done
                      ? 'btn btn--ghost goal__btn goal__btn--on'
                      : 'btn btn--ghost goal__btn'
                  }
                  disabled={target.settled}
                  onClick={() => settle(target.id, false)}
                >
                  ☐ 没完成
                </button>
              </div>
            </>
          ) : (
            <p className="goal__empty">
              还没有可以结算的目标。在下面写下周要做的，下周这个时候回来打分。
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
          <button
            type="button"
            className="btn btn--primary"
            onClick={save}
            disabled={!draft.trim()}
          >
            保存
          </button>
        </div>

        <p className="meta">
          {nextGoal
            ? `下周已记下：${nextGoal.text}（再保存会覆盖这条）`
            : '保存时会把还没结算的旧目标一起结掉，一周只留一条目标。'}
        </p>
      </section>
    </div>
  )
}
