import { stageRangeText } from '../lib/stages'
import type { Goal, Stage } from '../lib/types'

type Props = {
  /** 今天落在里面、结束最近的那个阶段；没有就是 undefined */
  stage?: Stage
  /** 这个阶段下的所有目标（页面里用 goalsOfStage 取好传进来） */
  goals: Goal[]
  onOpenGoal: () => void
}

const SHOWN = 3

/**
 * 首页的「阶段目标」卡。阶段本身由上面那条阶段条交代（第 N 阶段 · 标题 · 还剩几周），
 * 所以这里不再重复写阶段名，只标一个起止，免得两块内容长得一样。
 *
 * 以前这里是「本周目标」一条，后来变成周期（一个学期 / 一个暑假），
 * 一屏写不下，所以只列没做完的前三条，后面用「还有 N 条」收口，
 * 想看全部点「去查看」。
 */
export default function HomeGoal({ stage, goals, onOpenGoal }: Props) {
  const done = goals.filter(goal => goal.done).length
  const pending = goals.filter(goal => !goal.done)
  const shown = pending.slice(0, SHOWN)
  const rest = pending.length - shown.length
  const allDone = goals.length > 0 && pending.length === 0

  return (
    <section className="card home-goal" aria-label="当前阶段目标">
      <div className="card__head">
        <span className="card__title">阶段目标</span>
        {stage && <span className="card__note">{stageRangeText(stage)}</span>}
      </div>

      {!stage ? (
        <>
          <p className="home-goal__empty">还没有在进行的阶段</p>
          <button type="button" className="btn btn--ghost home-goal__more" onClick={onOpenGoal}>
            去定目标
          </button>
        </>
      ) : goals.length === 0 ? (
        <>
          <p className="home-goal__empty">这个阶段还没定目标</p>
          <button type="button" className="btn btn--ghost home-goal__more" onClick={onOpenGoal}>
            去定目标
          </button>
        </>
      ) : (
        <>
          {allDone ? (
            <p className="home-goal__empty">这个阶段的目标都完成了</p>
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
