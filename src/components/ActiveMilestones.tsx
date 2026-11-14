import { dayKey, formatDateCn } from '../lib/date'
import type { ActiveMilestone } from '../lib/milestones'

type Props = {
  /** 首页算好的那几条：当前阶段、还没确认完成、且真的有任务 */
  rows: ActiveMilestone[]
  onOpen: () => void
}

/**
 * 首页「进行中的里程碑」：最多三条，每条是标题 + 进度 x/y + 最近完成时间。
 *
 * 进度是从关联任务现算的（见 lib/milestones.ts），不另存一份 ——
 * 勾一条任务，这里立刻跟着变。任务全勾完但还没确认的挂一个「待确认」角标，
 * 提醒人去写证据、点完成。
 *
 * 整行是个按钮，点了跳目标页（那里才能改标准、写证据）。
 */
export default function ActiveMilestones({ rows, onOpen }: Props) {
  return (
    <section className="card ms" aria-label="进行中的里程碑">
      <div className="card__head">
        <span className="card__title">进行中的里程碑</span>
        <button type="button" className="btn btn--ghost ms__more" onClick={onOpen}>
          去查看
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="card__empty">当前阶段还没有在推进的里程碑</p>
      ) : (
        <ul className="ms__list">
          {rows.map(row => (
            <li key={row.item.id}>
              <button
                type="button"
                className="ms__item"
                onClick={onOpen}
                aria-label={`里程碑：${row.item.title}，完成 ${row.stats.done} / ${row.stats.total}`}
              >
                <span className="ms__head">
                  <span className="ms__title">{row.item.title}</span>
                  {row.state === 'confirm' && <span className="ms__badge">待确认</span>}
                </span>
                <span className="ms__meta">
                  <span className="ms__count">
                    {row.stats.done}/{row.stats.total}
                  </span>
                  <span className="ms__last">
                    {row.last === undefined
                      ? '还没完成过任务'
                      : `最近 ${formatDateCn(dayKey(row.last))} 完成`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
