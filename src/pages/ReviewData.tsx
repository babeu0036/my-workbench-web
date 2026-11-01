import { formatWeekRange, weekKeyOf } from '../lib/date'
import { MOOD_OPTIONS, moodEmoji, moodOf, weekMoodCounts } from '../lib/mood'
import type { MoodMap } from '../lib/mood'
import { activeDays, dailyCounts, streak, weekTotals } from '../lib/stats'
import type { Todo } from '../lib/types'

type Props = {
  todos: Todo[]
  /** 今日状态按日期键存的那张表，App 传进来 */
  moods: MoodMap
}

/**
 * 复盘 · 数据。只放统计，完全不碰目标 ——
 * 目标和它是两个独立页面，改一边的排版不会牵连另一边。
 */
export default function ReviewData({ todos, moods }: Props) {
  const totals = weekTotals(todos)
  const active = activeDays(todos)
  const days = streak(todos)
  const daily = dailyCounts(todos)
  // 和上面那组一样是「本周一到周日」，所以两个数字放在一起不会打架
  const moodWeek = weekMoodCounts(moods)

  // 最高那天决定柱子满格多高；全是 0 时 peak = 0，下面的除法要绕开
  const peak = daily.reduce((acc, day) => (day.count > acc ? day.count : acc), 0)
  const weekSum = daily.reduce((acc, day) => acc + day.count, 0)

  return (
    <div className="page">
      <h2 className="page__title">数据</h2>
      <p className="page__hint">本周 {formatWeekRange(weekKeyOf())}</p>

      <div className="stat-grid">
        <div className="stat stat--wide">
          <div className="stat__row">
            <span className="stat__num">
              {totals.done}
              <span className="stat__sep">/</span>
              {totals.total}
            </span>
            <span className="stat__pct">{totals.percent}%</span>
          </div>
          <span className="stat__label">本周完成</span>
          {/* 进度条只是把百分比画出来，读屏仍然读上面那句 */}
          <div
            className="meter"
            role="img"
            aria-label={`本周完成 ${totals.done} 件，共 ${totals.total} 件，百分之 ${totals.percent}`}
          >
            <div className="meter__fill" style={{ width: `${totals.percent}%` }} />
          </div>
        </div>

        <div className="stat">
          <span className="stat__num">
            {active}
            <span className="stat__sep">/</span>7
          </span>
          <span className="stat__label">本周活跃天数</span>
        </div>

        <div className="stat">
          <span className="stat__num">{days}</span>
          <span className="stat__label">连续天数</span>
        </div>
      </div>

      {totals.total === 0 && (
        <p className="meta">本周还没有任务。去首页加一条，这里就有数了。</p>
      )}

      <section className="card moodstat" aria-labelledby="moodstat-title">
        <div className="card__head">
          <span className="card__title" id="moodstat-title">
            状态分布
          </span>
          <span className="card__note">本周 {formatWeekRange(weekKeyOf())}</span>
        </div>

        {moodWeek.total === 0 ? (
          <p className="card__empty">这周还没记状态</p>
        ) : (
          <ul className="moodstat__list">
            {MOOD_OPTIONS.map(option => (
              <li key={option.value} className="moodstat__row">
                <span className="moodstat__emoji" aria-hidden="true">
                  {option.emoji}
                </span>
                <span className="moodstat__label">{option.short}</span>
                <span className="moodstat__days">{moodWeek[option.value]} 天</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card days" aria-labelledby="days-title">
        <div className="days__head">
          <span className="card__title" id="days-title">
            最近 7 天
          </span>
          <span className="days__sum">共 {weekSum} 件</span>
        </div>

        <div className="days__chart">
          {daily.map(day => {
            // 有完成的至少给 12% 高，否则 1 件和 5 件在低分辨率下看不出区别
            const height = day.count === 0 ? 0 : Math.max(12, Math.round((day.count / peak) * 100))
            // 那天记了心情就给颗 emoji，顺便把柱子染成对应颜色；没记就两样都不加
            const mood = moodOf(moods, day.key)
            const moodFace = moodEmoji(mood)
            const barClass = [
              'day__bar',
              day.count === 0 ? 'day__bar--zero' : '',
              mood ? `day__bar--${mood}` : '',
              day.isToday ? 'day__bar--today' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <div
                key={day.key}
                className={day.isToday ? 'day day--today' : 'day'}
                aria-label={`${day.weekday} 完成 ${day.count} 件${mood ? `，状态${MOOD_OPTIONS.find(item => item.value === mood)?.label}` : ''}`}
              >
                <span className="day__num">{day.count === 0 ? '' : day.count}</span>
                <span className="day__track">
                  <span className={barClass} style={{ height: `${height}%` }} />
                </span>
                {/* 没记心情时不画空框也不留符号，但这一格照旧占位 —— 7 个星期几要对齐 */}
                <span className="day__mood" aria-hidden="true">
                  {moodFace}
                </span>
                <span className="day__label">{day.weekday}</span>
              </div>
            )
          })}
        </div>

        <p className="meta">
          滚动的 7 天，可能跨周，所以和上面「本周完成」不一定对得上；只认完成时间，撤销完成就不算了。
        </p>
      </section>
    </div>
  )
}
