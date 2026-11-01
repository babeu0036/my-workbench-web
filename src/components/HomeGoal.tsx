import { formatWeekRange, weekKeyOf } from '../lib/date'
import type { Goal } from '../lib/types'

type Props = {
  /** 本周目标（goalOf 在页面里取好传进来），没有就是 undefined */
  goal?: Goal
  onOpenGoal: () => void
}

/**
 * 首页顶部的本周目标卡。
 *
 * 只有「还没结算」才是进行中；结算过的就是这周的记录，不再改判，
 * 所以点了完成之后这里显示「已完成」，而不是继续挂着「进行中」。
 */
export default function HomeGoal({ goal, onOpenGoal }: Props) {
  return (
    <section className="card home-goal" aria-label="本周目标">
      <div className="card__head">
        <span className="card__title">本周目标</span>
        <span className="card__note">{formatWeekRange(weekKeyOf())}</span>
      </div>

      {goal ? (
        <>
          <p className="home-goal__text">{goal.text}</p>
          <div className="home-goal__foot">
            {!goal.settled ? (
              <span className="status status--running">进行中</span>
            ) : goal.done ? (
              <span className="status status--done">已完成</span>
            ) : (
              <span className="status status--closed">没完成</span>
            )}
            <button type="button" className="btn btn--ghost home-goal__more" onClick={onOpenGoal}>
              去复盘
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="home-goal__empty">本周还没定目标</p>
          <button type="button" className="btn btn--ghost home-goal__more" onClick={onOpenGoal}>
            去定目标
          </button>
        </>
      )}
    </section>
  )
}
