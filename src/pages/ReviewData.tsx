import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import PlanNextWeek from '../components/PlanNextWeek'
import { formatWeekRange } from '../lib/date'
import {
  closureScope,
  nextWeekSundayKey,
  reviewOf,
  saveReview,
  sortedReviews,
  thisWeekKey,
  weekClosure,
} from '../lib/reviews'
import type { Achievement, Review, Stage, Todo } from '../lib/types'

type Props = {
  /** 完整任务（含目标页的里程碑任务）：本周闭环要数挂了 achievementId 的那些 */
  todos: Todo[]
  achievements: Achievement[]
  stages: Stage[]
  reviews: Review[]
  setReviews: Dispatch<SetStateAction<Review[]>>
  /**
   * 把「下周具体做什么」变成一条待办，并把 todoId 记进本周复盘。
   * 写 todos 和写 reviews 都在 App 里，这一页只负责收集输入。
   */
  onPlanNextWeek: (
    achievementId: number,
    text: string,
    dueDate: string,
    snapshot: { movedCount: number; totalCount: number },
  ) => void
}

/** 一句话摘要：三句里第一句有内容的，长了截断 */
function summaryOf(review: Review): string {
  const line = review.best || review.stuck || review.next
  if (!line) return '这周只把任务排进了下周'
  return line.length > 40 ? `${line.slice(0, 40)}…` : line
}

/**
 * 复盘。从上到下四块，回答四个问题：
 *
 * A. 本周做了多少、其中多少真挂在里程碑上 —— 一条一句话的数；
 * B. 这周哪些里程碑根本没动 —— 下周先补这些；
 * C. 这周最有价值的一件事 / 卡在哪 / 下周最重要的一件事；
 * D. 以前写的那些周。
 *
 * 这里不再有 7 天柱状图和情绪分布：复盘的重点从「统计」换成了「下一周做什么」，
 * 首页已经有完成环和连续天数，重复的数字多了只会让人跳过这一页。
 *
 * 一周一条（`weekStart` = 周一日期键），再保存就覆盖；「下周做它」生成的
 * 任务也记在这一周的 generated 里，所以按钮点过就一直是「已加入下周」。
 */
export default function ReviewData({
  todos,
  achievements,
  stages,
  reviews,
  setReviews,
  onPlanNextWeek,
}: Props) {
  const now = Date.now()
  const weekKey = thisWeekKey(now)
  const review = reviewOf(reviews, weekKey)

  const closure = weekClosure(todos, now)
  const scope = closureScope(achievements, todos, stages, now)

  const [best, setBest] = useState(review?.best ?? '')
  const [stuck, setStuck] = useState(review?.stuck ?? '')
  const [next, setNext] = useState(review?.next ?? '')
  const [saved, setSaved] = useState(false)
  const [planning, setPlanning] = useState<Achievement | null>(null)
  const [openWeek, setOpenWeek] = useState<string | null>(null)

  // 本周已经排进下周的里程碑：按钮据此变成「已加入下周」
  const planned = new Set((review?.generated ?? []).map(entry => entry.achievementId))
  const rows = scope.rows.slice(0, 3)
  const history = sortedReviews(reviews)

  function touch(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      setSaved(false)
    }
  }

  function handleSave() {
    setReviews(list =>
      saveReview(list, {
        weekStart: weekKey,
        best,
        stuck,
        next,
        movedCount: scope.movedCount,
        totalCount: scope.totalCount,
      }),
    )
    setSaved(true)
  }

  return (
    <div className="page">
      <h2 className="page__title">复盘</h2>
      <p className="page__hint">本周 {formatWeekRange(weekKey)}</p>

      {/* A. 一句话：本周完成了多少，多少真挂了里程碑 */}
      <section className="card week" aria-labelledby="week-title">
        <div className="card__head">
          <span className="card__title" id="week-title">
            本周
          </span>
          <span className="week__pct">{closure.done === 0 ? '—' : `${closure.percent}%`}</span>
        </div>
        <p className="week__line">
          {closure.done === 0
            ? '这周还没有完成任何任务'
            : `本周完成 ${closure.done} 条，其中 ${closure.linked} 条挂在里程碑上（${closure.percent}%）`}
        </p>
        <div
          className="meter"
          role="img"
          aria-label={
            closure.done === 0
              ? '本周还没有完成任何任务'
              : `本周完成 ${closure.done} 条，其中 ${closure.linked} 条挂在里程碑上，百分之 ${closure.percent}`
          }
        >
          <div className="meter__fill" style={{ width: `${closure.percent}%` }} />
        </div>
      </section>

      {/* B. 这周没动的里程碑 */}
      <section className="card stallcard" aria-labelledby="stall-title">
        <div className="card__head">
          <span className="card__title" id="stall-title">
            这周没动的里程碑
          </span>
          {scope.totalCount > 0 && (
            <span className="card__note">
              推进 {scope.movedCount}/{scope.totalCount}
            </span>
          )}
        </div>

        {!scope.hasMilestones ? (
          <p className="card__empty">还没有里程碑，先去目标页定一个</p>
        ) : rows.length === 0 ? (
          <p className="card__empty">这个阶段的里程碑这周都推进了</p>
        ) : (
          <ul className="stall">
            {rows.map(row => {
              const done = planned.has(row.item.id)
              return (
                <li key={row.item.id} className="stall__row">
                  <div className="stall__main">
                    <span className="stall__title">{row.item.title}</span>
                    <span className="stall__meta">
                      {row.stageTitle}
                      {' · '}
                      {row.days === undefined
                        ? '还没有行动'
                        : row.days === 0
                          ? '上次推进：今天'
                          : `上次推进：${row.days} 天前`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost stall__btn"
                    onClick={() => setPlanning(row.item)}
                    disabled={done}
                  >
                    {done ? '已加入下周' : '下周做它'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* C. 三句话 */}
      <section className="card reviewform" aria-labelledby="reviewform-title">
        <div className="card__head">
          <span className="card__title" id="reviewform-title">
            这周写三句
          </span>
          {saved && <span className="card__note">已保存到这一周</span>}
        </div>

        <label className="reviewform__field">
          <span className="reviewform__label">这周最有价值的一件事</span>
          <textarea
            className="input reviewform__input"
            value={best}
            onChange={event => touch(setBest)(event.target.value)}
            placeholder="哪件事让这周没白过"
            maxLength={200}
            rows={2}
          />
        </label>

        <label className="reviewform__field">
          <span className="reviewform__label">卡在哪</span>
          <textarea
            className="input reviewform__input"
            value={stuck}
            onChange={event => touch(setStuck)(event.target.value)}
            placeholder="哪个环节一直过不去"
            maxLength={200}
            rows={2}
          />
        </label>

        <label className="reviewform__field">
          <span className="reviewform__label">下周最重要的一件事</span>
          <textarea
            className="input reviewform__input"
            value={next}
            onChange={event => touch(setNext)(event.target.value)}
            placeholder="只写一件，写多了等于没写"
            maxLength={200}
            rows={2}
          />
        </label>

        <button type="button" className="btn btn--primary form__submit" onClick={handleSave}>
          保存这周复盘
        </button>
      </section>

      {/* D. 历史 */}
      {history.length > 0 && (
        <section className="card" aria-labelledby="history-title">
          <div className="card__head">
            <span className="card__title" id="history-title">
              以前的复盘
            </span>
            <span className="card__note">{history.length} 周</span>
          </div>

          <ul className="hist">
            {history.map(item => {
              const open = openWeek === item.weekStart
              return (
                <li key={item.weekStart} className="hist__item">
                  <button
                    type="button"
                    className="hist__head"
                    onClick={() => setOpenWeek(open ? null : item.weekStart)}
                    aria-expanded={open}
                  >
                    <span className="hist__week">{formatWeekRange(item.weekStart)}</span>
                    <span className="hist__sum">{summaryOf(item)}</span>
                    <span className="hist__arrow" aria-hidden="true">
                      {open ? '▾' : '▸'}
                    </span>
                  </button>

                  {open && (
                    <div className="hist__body">
                      <p className="hist__line">
                        <span className="hist__key">最有价值</span>
                        {item.best || '—'}
                      </p>
                      <p className="hist__line">
                        <span className="hist__key">卡在哪</span>
                        {item.stuck || '—'}
                      </p>
                      <p className="hist__line">
                        <span className="hist__key">下周最重要</span>
                        {item.next || '—'}
                      </p>
                      <p className="hist__foot">
                        当时推进 {item.movedCount}/{item.totalCount} 条里程碑
                        {item.generated.length > 0 && ` · 排了 ${item.generated.length} 件事到下周`}
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {planning && (
        <PlanNextWeek
          achievement={planning}
          defaultDate={nextWeekSundayKey(now)}
          onClose={() => setPlanning(null)}
          onSubmit={(text, dueDate) => {
            onPlanNextWeek(planning.id, text, dueDate, {
              movedCount: scope.movedCount,
              totalCount: scope.totalCount,
            })
            setPlanning(null)
          }}
        />
      )}
    </div>
  )
}
