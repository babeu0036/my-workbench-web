type Props = {
  /** 今天完成数 / 今天该做的总数 */
  done: number
  total: number
  /** 0-100 的整数，和 done/total 同一处算好传进来，界面上不会出现两个口径 */
  percent: number
  /** 连续有完成的天数，0 就不显示 */
  streak: number
}

const SIZE = 76
const STROKE = 8
const RADIUS = (SIZE - STROKE) / 2
/** 圆周长：stroke-dasharray 用它，dashoffset 用它乘 (1 - 百分比) */
const CIRCUM = 2 * Math.PI * RADIUS

/**
 * 首页的今日进度：左边一个完成环，右边完成数和连续天数。
 *
 * 环是自己画的两个 <circle>，不引图表库 —— 一个进度环不值得多几十 KB。
 * 环只负责好看，读屏读的是 svg 的 aria-label：百分比、几件、共几件都说全。
 */
export default function HomeStats({ done, total, percent, streak }: Props) {
  const ratio = Math.min(100, Math.max(0, percent))
  const offset = CIRCUM * (1 - ratio / 100)

  return (
    <section className="card home-stats" aria-label="今日进度">
      <div className="home-stats__ring">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={
            total === 0
              ? '今天没有要做的任务'
              : `今天完成 ${done} 件，共 ${total} 件，百分之 ${ratio}`
          }
        >
          <circle
            className="ring__track"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
          />
          {/* 0% 时不画，免得圆头线帽在起点留一个点，看着像已经做了一点 */}
          {ratio > 0 && (
            <circle
              className="ring__fill"
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUM}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          )}
        </svg>
        <span className="home-stats__pct" aria-hidden="true">
          {total === 0 ? '—' : `${ratio}%`}
        </span>
      </div>

      <div className="home-stats__side">
        <span className="home-stats__label">今天完成</span>
        <span className="home-stats__num">
          {done}
          <span className="home-stats__sep">/</span>
          {total}
        </span>
        {/* 连续 0 天不显示，新用户不该一进来就看到「连续 0 天」 */}
        {streak > 0 && <span className="home-stats__streak">🔥 连续 {streak} 天</span>}
        {total === 0 && <span className="meta">今天没有要做的任务</span>}
      </div>
    </section>
  )
}
