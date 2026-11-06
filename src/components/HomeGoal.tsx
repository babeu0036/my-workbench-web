import { periodRangeText } from '../lib/goals'
import type { Goal, GoalPeriod } from '../lib/types'

type Props = {
  /** 今天落在里面、结束最近的那个周期；没有就是 undefined */
  period?: GoalPeriod
  /** 这个周期下的所有目标（页面里用 goalsOf 取好传进来） */
  goals: Goal[]
  onOpenGoal: () => void
}

const SHOWN = 3

/**
 * 首页的「当前周期目标」卡。
 *
 * 以前这里是「本周目标」一条，现在周期可能是一个学期或一个暑假，
 * 一屏写不下，所以只列没做完的前三条，后面用「还有 N 条」收口，
 * 想看全部点「去查看」。
 */
export default function HomeGoal({ period, goals, onOpenGoal }: Props) {
  const done = goals.filter(goal => goal.done).length
  const pending = goals.filter(goal => !goal.done)
  const shown = pending.slice(0, SHOWN)
  const rest = pending.length - shown.length
  const allDone = goals.length > 0 && pending.length === 0

  return (
    <section className="card home-goal" aria-label="当前周期目标">
      <div className="card__head">
        <span className="card__title">{period ? period.title : '目标'}</span>
        {period && <span className="card__note">{periodRangeText(period)}</span>}
      </div>

      {!period ? (
        <>
          <p className="home-goal__empty">还没有在进行的周期</p>
          <button type="button" className="btn btn--ghost home-goal__more" onClick={onOpenGoal}>
            去定目标
          </button>
        </>
      ) : goals.length === 0 ? (
        <>
          <p className="home-goal__empty">这个周期还没定目标</p>
          <button type="button" className="btn btn--ghost home-goal__more" onClick={onOpenGoal}>
            去定目标
          </button>
        </>
      ) : (
        <>
          {allDone ? (
            <p className="home-goal__empty">这个周期的目标都完成了</p>
          ) : (
            <ul className="home-goal__list">
              {shown.map(goal => (
                <li key={goal.id} className="home-goal__item">
                  {goal.text}
                </li>
              ))}
            </ul>
          )}

          <div className="home-goal__foot">
            <span className={allDone ? 'status status--done' : 'status status--running'}>
              完成 {done} / {goals.length}
            </span>
            {rest > 0 && <span className="card__note">还有 {rest} 条</span>}
            <button type="button" className="btn btn--ghost home-goal__more" onClick={onOpenGoal}>
              去查看
            </button>
          </div>
        </>
      )}
    </section>
  )
}
