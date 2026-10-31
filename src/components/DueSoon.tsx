import { hasUrgent, dueDays, dueLabel, dueTone } from '../lib/due'
import type { Subject, Todo } from '../lib/types'

type Props = {
  /** 已经筛好、排好序的（最急的在前），这个组件不再算一遍 */
  items: Todo[]
  subjects: Subject[]
  /** 点某一条就跳到它所属的科目页去处理 */
  onOpenSubject: (subjectId: string) => void
}

/**
 * 首页顶部的到期提醒。
 * 进来只显示「未完成、且已经到到期前三天窗口里」的任务，逾期的一直留在最上面。
 * 勾完就自动从这儿消失 —— 不需要「已读」，也就不会出现点了不管用的情况。
 */
export default function DueSoon({ items, subjects, onOpenSubject }: Props) {
  if (items.length === 0) return null

  const urgent = hasUrgent(items)

  return (
    <section className={urgent ? 'alert alert--urgent' : 'alert'} aria-label="到期提醒">
      <div className="alert__head">
        <span className="alert__title">到期提醒</span>
        <span className="alert__count">{items.length} 件</span>
      </div>

      <ul className="alert__list">
        {items.map(todo => {
          const days = dueDays(todo)
          const subject = subjects.find(item => item.id === todo.subjectId)

          return (
            <li key={todo.id}>
              <button
                type="button"
                className="alert__row"
                onClick={() => onOpenSubject(todo.subjectId)}
                aria-label={`去${subject?.name ?? '未分类'}处理：${todo.text}，${dueLabel(days)}`}
              >
                <span className="alert__subject">{subject?.name ?? '未分类'}</span>
                <span className="alert__text">{todo.text}</span>
                <span className={`pill pill--${dueTone(days)}`}>{dueLabel(days)}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="alert__foot">到期前 3 天开始提醒，做完就消失</p>
    </section>
  )
}
