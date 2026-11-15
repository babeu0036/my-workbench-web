import { formatDateCn } from '../lib/date'
import { dueDays, dueLabel, dueTone } from '../lib/due'
import type { MilestoneOption } from '../lib/milestones'
import type { Todo } from '../lib/types'

type Props = {
  /** 已经按科目过滤好的数组，这个组件不关心科目 */
  todos: Todo[]
  /** 一条都没有时显示什么，各个页面的说法不一样 */
  empty: string
  onToggle: (id: number) => void
  onRemove: (id: number) => void
  /** 点行正文进编辑；不传就是只读的行（只有勾选和删除可用） */
  onEdit?: (id: number) => void
  /** 「服务于」的下拉选项，用来把 goalId 翻成标题；不传就不显示小标签 */
  milestones?: MilestoneOption[]
  /**
   * 缩进 + 左侧竖线 + 每行一个小圆点：挂在阶段目标下面时用。
   * 目的是让人一眼看出这一层属于上面那张卡，而不是另一份平铺清单。
   */
  nested?: boolean
  /**
   * 右侧标签写什么：
   * - `short`（默认）只写短名，计划页 / 科目页那种一行挤很多信息的地方用；
   * - `belongs` 写成「属于：全名」，首页今日任务用 —— 那里没有缩进，
   *   只写短名看不出是谁的。
   */
  goalLabel?: 'short' | 'belongs'
}

/**
 * 任务列表：勾选圆点负责完成 / 撤销，点正文进编辑，右侧是删除。
 * 文字下面那行是截止日期和剩余天数 —— 没完成的会按紧急程度变色，
 * 已完成的就只剩一个灰色日期，不再吵人。
 *
 * 任务挂了阶段目标（「服务于」）就在右侧多一个小标签：默认写短名，
 * 首页用 `goalLabel="belongs"` 写成「属于：全名」（全名放在 title 里，鼠标停上去能看）；
 * goalId 为空（日常事务）或者那条阶段目标已经被删了，就什么都不显示。
 * 状态全部由外部传进来，这里只渲染，不做任何过滤和计算。
 */
export default function TaskList({
  todos,
  empty,
  onToggle,
  onRemove,
  onEdit,
  milestones,
  nested = false,
  goalLabel = 'short',
}: Props) {
  if (todos.length === 0) {
    return <p className="empty">{empty}</p>
  }

  const byId = new Map((milestones ?? []).map(item => [item.id, item]))

  return (
    <ul className={nested ? 'list list--nested' : 'list'}>
      {todos.map(todo => {
        const days = dueDays(todo)
        // 老任务没有 dueDate，这一行就不显示，不硬塞一个「无日期」
        const dateText = todo.dueDate ? formatDateCn(todo.dueDate) : ''
        const goal = todo.goalId === undefined ? undefined : byId.get(todo.goalId)

        const body = (
          <>
            <span className={todo.done ? 'row__text row__text--done' : 'row__text'}>
              {todo.text}
            </span>
            {dateText && (
              <span className={todo.done ? 'row__date' : `row__date row__date--${dueTone(days)}`}>
                {dateText}
                {!todo.done && (
                  <>
                    {' · '}
                    <span className="nowrap">{dueLabel(days)}</span>
                  </>
                )}
              </span>
            )}
          </>
        )

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

            {onEdit ? (
              // 用按钮而不是给 span 挂 onClick：键盘 Tab 得到、读屏念得出「编辑」
              <button
                type="button"
                className="row__body row__edit"
                onClick={() => onEdit(todo.id)}
                aria-label={`编辑：${todo.text}`}
              >
                {body}
              </button>
            ) : (
              <span className="row__body">{body}</span>
            )}

            <span className="row__actions">
              {goal && (
                // 首页写「属于：全名」（空间不够时截掉名字，前缀留着）；
                // 其它页面只放短名，全名留给 title —— 十几个字的标题会把正文挤成三行
                <span
                  className={goalLabel === 'belongs' ? 'row__goal row__goal--belongs' : 'row__goal'}
                  title={`${goal.title} · ${goal.stageTitle}`}
                >
                  {goalLabel === 'belongs' ? `属于：${goal.title}` : goal.short}
                </span>
              )}
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
