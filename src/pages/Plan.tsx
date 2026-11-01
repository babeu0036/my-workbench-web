import type { Dispatch, SetStateAction } from 'react'
import Deadlines from './Deadlines'
import PlanCourses from './PlanCourses'
import PlanTasks from './PlanTasks'
import type { Deadline, PlanSegment, Subject, Todo } from '../lib/types'

const TITLES: Record<PlanSegment, string> = {
  courses: '课程表',
  tasks: '任务',
  deadlines: '比赛',
}

type Props = {
  seg: PlanSegment
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  subjects: Subject[]
  deadlines: Deadline[]
  setDeadlines: Dispatch<SetStateAction<Deadline[]>>
}

/**
 * 计划页只是个壳：标题 + 三块内容。
 * 切换交给侧边栏的二级项（课程表 / 任务 / 比赛），页面里不再放一条 seg ——
 * 两套切换会打架，复盘拆成两页之后也是这个做法。
 */
export default function Plan({ seg, todos, setTodos, subjects, deadlines, setDeadlines }: Props) {
  return (
    <div className="plan">
      <h2 className="page__title">{TITLES[seg]}</h2>

      {seg === 'courses' && <PlanCourses />}

      {seg === 'tasks' && <PlanTasks todos={todos} setTodos={setTodos} subjects={subjects} />}

      {seg === 'deadlines' && <Deadlines deadlines={deadlines} setDeadlines={setDeadlines} />}
    </div>
  )
}
