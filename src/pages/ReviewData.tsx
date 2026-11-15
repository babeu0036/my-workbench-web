import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import PlanNextWeek from '../components/PlanNextWeek'
import { formatWeekRange } from '../lib/date'
import {
  closureScope,
  hasOpenPlan,
  nextWeekSundayKey,
  normalizeReviewDraft,
  reviewOf,
  saveReview,
  sortedReviews,
  thisWeekKey,
  weekClosure,
} from '../lib/reviews'
import { KEYS, readKey, removeKey, writeKey } from '../lib/storage'
import type { Achievement, Review, ReviewDraft, Stage, Todo } from '../lib/types'

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

  // 本周的草稿：进页面时回填，写完自动落盘，保存复盘后删掉。
  // 只在挂载时读一次 —— 之后文本框就是唯一真相，不然边打字边被读盘覆盖。
  const [draft] = useState<ReviewDraft | null>(() =>
    normalizeReviewDraft(readKey<unknown>(KEYS.reviewDraft, null), weekKey),
  )
  const [best, setBest] = useState(draft?.best ?? review?.best ?? '')
  const [stuck, setStuck] = useState(draft?.stuck ?? review?.stuck ?? '')
  const [next, setNext] = useState(draft?.next ?? review?.next ?? '')
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [planning, setPlanning] = useState<Achievement | null>(null)
  const [openWeek, setOpenWeek] = useState<string | null>(null)

  const rows = scope.rows.slice(0, 3)
  const history = sortedReviews(reviews)

  /**
   * 输入停下来 600ms 就存一份草稿（`workbench.reviewDraft`）。
   *
   * 只在真改过（dirty）之后才写：一进页面就写的话，会把「这周还没动笔」变成
   * 一份空草稿，下次打开还得多判断一次空字符串。三个都清空就把键删掉 ——
   * 空草稿没有意义，留着只会同步一份空对象上去。
   */
  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => {
      if (!best.trim() && !stuck.trim() && !next.trim()) {
        removeKey(KEYS.reviewDraft)
        return
      }
      writeKey<ReviewDraft>(KEYS.reviewDraft, { weekStart: weekKey, best, stuck, next })
    }, 600)
    return () => window.clearTimeout(timer)
  }, [best, stuck, next, dirty, weekKey])

  function touch(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      setDirty(true)
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
    // 存进这一周的复盘里了，草稿就没用了
    removeKey(KEYS.reviewDraft)
    setDirty(false)
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
        <p className="week__new">这周新加了 {closure.created} 条任务</p>
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
              // 这条里程碑上还有没做完的活就算「已加入下周」，全做完/删掉了自动退回可点
              const done = hasOpenPlan(todos, row.item.id)
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
