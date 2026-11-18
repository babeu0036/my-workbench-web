import { hasUrgent, dueDays, dueLabel, dueTone } from '../lib/due'
import type { Subject, Todo } from '../lib/types'

type Props = {
  /** 已经筛好、排好序的（最急的在前），这个组件不再算一遍 */
  items: Todo[]
  subjects: Subject[]
  /** 点行主体：打开这条任务的编辑面板 —— 有没有科目都一样 */
  onEditTask: (todoId: number) => void
  /** 点科目名小标签：调用方已经确认这个科目存在，直接跳 */
  onOpenSubject: (subjectId: string) => void
}

/**
 * 首页顶部的到期提醒。
 * 进来只显示「未完成、且已经到到期前三天窗口里」的任务，逾期的一直留在最上面。
 * 勾完就自动从这儿消失 —— 不需要「已读」，也就不会出现点了不管用的情况。
 *
 * 一行里有两颗按钮，各管各的：
 * - 行主体（任务名 + 截止日期）→ 打开这条任务的编辑面板，不管它有没有科目；
 * - 科目名小标签 → 跳科目页。科目找不到（没科目 / 科目被删）就只是灰色「未分类」，
 *   不做成按钮、点了也不跳，免得进一个「没有此科目」的页面。
 *
 * 行本身是 div 不是 button：按钮不能套按钮，而且整行可点会跟科目名那颗抢点击。
 */
export default function DueSoon({ items, subjects, onEditTask, onOpenSubject }: Props) {
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
          // subjectId 为空就是没科目，别拿空字符串去 subjects 里捞（未分类不是真科目）
          const subject = todo.subjectId
            ? subjects.find(item => item.id === todo.subjectId)
            : undefined

          return (
            <li key={todo.id}>
              <div className="alert__row">
                {subject ? (
                  <button
                    type="button"
                    className="alert__subject"
                    // 别让这一下顺带把编辑面板也打开：跳科目页就只跳科目页
                    onClick={event => {
                      event.stopPropagation()
                      onOpenSubject(subject.id)
                    }}
                    aria-label={`打开科目：${subject.name}`}
                  >
                    {subject.name}
                  </button>
                ) : (
                  <span className="alert__subject alert__subject--none">未分类</span>
                )}

                <button
                  type="button"
                  className="alert__main"
                  onClick={() => onEditTask(todo.id)}
                  aria-label={`编辑：${todo.text}`}
                >
                  <span className="alert__text">{todo.text}</span>
                  <span className={`pill pill--${dueTone(days)}`}>{dueLabel(days)}</span>
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="alert__foot">到期前 3 天开始提醒，做完就消失</p>
    </section>
  )
}
