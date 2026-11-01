import { formatDateCn } from '../lib/date'
import { dueDays, dueLabel, dueTone } from '../lib/due'
import type { Todo } from '../lib/types'

type Props = {
  /** 已经按科目过滤好的数组，这个组件不关心科目 */
  todos: Todo[]
  /** 一条都没有时显示什么，各个页面的说法不一样 */
  empty: string
  onToggle: (id: number) => void
  onRemove: (id: number) => void
}

/**
 * 任务列表：勾选圆点负责完成 / 撤销，右侧是删除。
 * 文字下面那行是截止日期和剩余天数 —— 没完成的会按紧急程度变色，
 * 已完成的就只剩一个灰色日期，不再吵人。
 * 状态全部由外部传进来，这里只渲染，不做任何过滤和计算。
 */
export default function TaskList({ todos, empty, onToggle, onRemove }: Props) {
  if (todos.length === 0) {
    return <p className="empty">{empty}</p>
  }

  return (
    <ul className="list">
      {todos.map(todo => {
        const days = dueDays(todo)
        // 老任务没有 dueDate，这一行就不显示，不硬塞一个「无日期」
        const dateText = todo.dueDate ? formatDateCn(todo.dueDate) : ''

        return (
          <li key={todo.id} className="row row--todo">
            <button
              type="button"
              className={todo.done ? 'check check--on' : 'check'}
              onClick={() => onToggle(todo.id)}
              aria-pressed={todo.done}
              aria-label={todo.done ? `撤销完成：${todo.text}` : `标记完成：${todo.text}`}
            >
              {todo.done ? '✓' : ''}
            </button>

            <span className="row__body">
              <span className={todo.done ? 'row__text row__text--done' : 'row__text'}>
                {todo.text}
              </span>
              {dateText && (
                <span
                  className={
                    todo.done ? 'row__date' : `row__date row__date--${dueTone(days)}`
                  }
                >
                  {dateText}
                  {!todo.done && (
                    <>
                      {' · '}
                      <span className="nowrap">{dueLabel(days)}</span>
                    </>
                  )}
                </span>
              )}
            </span>

            <span className="row__actions">
              <button
                type="button"
                className="btn btn--ghost btn--danger"
                onClick={() => onRemove(todo.id)}
                aria-label={`删除：${todo.text}`}
              >
                删除
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
