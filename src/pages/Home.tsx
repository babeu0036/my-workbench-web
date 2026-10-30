import type { Dispatch, SetStateAction } from 'react'
import TodoPage from './Todo'
import { todayLabel } from '../lib/date'
import type { Todo } from '../lib/types'

type Props = {
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
}

/**
 * 首页。第一步先把原来的待办列表挂进来当「今日任务」，
 * 保证换导航的中间态里任务还能勾选、还能加；
 * 日期之外的连续天数、本周目标卡留到第 3 步。
 */
export default function Home({ todos, setTodos }: Props) {
  return (
    <>
      <div className="page">
        <h2 className="page__title">首页</h2>
        <p className="page__hint">{todayLabel()} · 今天的任务</p>
      </div>

      <TodoPage todos={todos} setTodos={setTodos} />
    </>
  )
}
