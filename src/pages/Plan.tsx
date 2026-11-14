import type { Dispatch, SetStateAction } from 'react'
import Deadlines from './Deadlines'
import PlanCourses from './PlanCourses'
import PlanTasks from './PlanTasks'
import type { MilestoneOption } from '../lib/milestones'
import type { Course, Deadline, PlanSegment, Subject, Todo } from '../lib/types'

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
  /** 「服务于」的选项，任务列表和添加面板都要用 */
  milestones: MilestoneOption[]
  deadlines: Deadline[]
  setDeadlines: Dispatch<SetStateAction<Deadline[]>>
  courses: Course[]
  setCourses: Dispatch<SetStateAction<Course[]>>
  semesterStart: string
  setSemesterStart: Dispatch<SetStateAction<string>>
}

/**
 * 计划页只是个壳：标题 + 三块内容。
 * 切换交给侧边栏的二级项（课程表 / 任务 / 比赛），页面里不再放一条 seg ——
 * 两套切换会打架，复盘拆成两页之后也是这个做法。
 */
export default function Plan({
  seg,
  todos,
  setTodos,
  subjects,
  milestones,
  deadlines,
  setDeadlines,
  courses,
  setCourses,
  semesterStart,
  setSemesterStart,
}: Props) {
  return (
    <div className="plan">
      <h2 className="page__title">{TITLES[seg]}</h2>

      {seg === 'courses' && (
        <PlanCourses
          courses={courses}
          setCourses={setCourses}
          semesterStart={semesterStart}
          setSemesterStart={setSemesterStart}
          subjects={subjects}
        />
      )}

      {seg === 'tasks' && (
        <PlanTasks todos={todos} setTodos={setTodos} subjects={subjects} milestones={milestones} />
      )}

      {seg === 'deadlines' && (
        <Deadlines
          deadlines={deadlines}
          setDeadlines={setDeadlines}
          milestones={milestones}
        />
      )}
    </div>
  )
}
