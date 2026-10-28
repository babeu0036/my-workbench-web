import { daysUntil, daysLabel, formatDate, todayLabel } from '../lib/date'
import type { Deadline, TabKey, Todo } from '../lib/types'

type Props = {
  todos: Todo[]
  deadlines: Deadline[]
  onGo: (tab: TabKey) => void
}

export default function Home({ todos, deadlines, onGo }: Props) {
  const pending = todos.filter(t => !t.done).length
  const doneCount = todos.length - pending

  // 未结束（含今天截止）里最近的一场
  const upcoming = deadlines
    .map(item => ({ ...item, days: daysUntil(item.date) }))
    .filter(item => !Number.isNaN(item.days) && item.days >= 0)
    .sort((a, b) => a.days - b.days)[0]

  return (
    <div className="page">
      <p className="page__hint">{todayLabel()}</p>

      <button type="button" className="card card--link" onClick={() => onGo('todo')}>
        <span className="card__head">
          <span className="card__title">待办</span>
          <span className="card__arrow" aria-hidden="true">
            →
          </span>
        </span>

        {todos.length === 0 ? (
          <span className="card__empty">还没有待办，去加一条</span>
        ) : (
          <>
            <span className="card__main">
              未完成 <strong>{pending}</strong> 条
            </span>
            <span className="card__sub">
              {pending === 0 ? '都做完了，休息一下' : `共 ${todos.length} 条，已完成 ${doneCount} 条`}
            </span>
          </>
        )}
      </button>

      <button type="button" className="card card--link" onClick={() => onGo('deadlines')}>
        <span className="card__head">
          <span className="card__title">最近的比赛</span>
          <span className="card__arrow" aria-hidden="true">
            →
          </span>
        </span>

        {upcoming ? (
          <>
            <span className="card__main card__main--name">{upcoming.name}</span>
            <span className="card__sub">
              {formatDate(upcoming.date)} ·{' '}
              <strong className={upcoming.days <= 3 ? 'text-warn' : undefined}>
                {daysLabel(upcoming.days)}
              </strong>
            </span>
          </>
        ) : (
          <span className="card__empty">
            {deadlines.length === 0 ? '还没有比赛，去加一个' : '暂时没有进行中的比赛'}
          </span>
        )}
      </button>
    </div>
  )
}
