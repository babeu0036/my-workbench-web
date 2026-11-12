import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AddTaskPanel from '../components/AddTaskPanel'
import DueSoon from '../components/DueSoon'
import HomeGoal from '../components/HomeGoal'
import HomeStats from '../components/HomeStats'
import MoodPicker from '../components/MoodPicker'
import TaskList from '../components/TaskList'
import TodayCourses from '../components/TodayCourses'
import TomorrowBlock from '../components/TomorrowBlock'
import { todayCourses, tomorrowCourses } from '../lib/courses'
import { dayKey, todayLabel } from '../lib/date'
import { currentStage } from '../lib/stages'
import { goalsOfStage } from '../lib/goals'
import { moodOf, setMood } from '../lib/mood'
import type { MoodMap } from '../lib/mood'
import { streak, todayTasks, todayTotals } from '../lib/stats'
import { KEYS, useStoredState } from '../lib/storage'
import {
  UNCATEGORIZED_ID,
  addTodo,
  clearDone,
  removeTodo,
  sortForPlan,
  tomorrowTasks,
  toggleTodo,
  updateTodo,
} from '../lib/todos'
import type { Course, Goal, Stage, Subject, Todo, TodoKind } from '../lib/types'

type Props = {
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  subjects: Subject[]
  /** 该提醒的任务，最急的在前；在 App 里算好传进来，侧边栏角标用的是同一份 */
  dueItems: Todo[]
  goals: Goal[]
  /** 阶段：首页只显示「今天落在里面、结束最近」的那一个 */
  stages: Stage[]
  courses: Course[]
  /** 学期第 1 周的周一，决定「今天有课」里的课这周上不上 */
  semesterStart: string
  /** 今日状态：存在 App 里，复盘页读的是同一份 */
  moods: MoodMap
  setMoods: Dispatch<SetStateAction<MoodMap>>
  onOpenSubject: (subjectId: string) => void
  onOpenGoal: () => void
  /** 「明天」里的任务只能看不能勾，点了统一跳计划页 */
  onOpenPlan: () => void
}

/**
 * 首页。从上到下：本周目标 → 到期提醒 → 今天有课 → 今日进度 → 今天的任务
 * → 明天 → 今日状态。
 *
 * 任务列表只放「今天到期 + 逾期」：标题写「今天的任务」就得真只放今天的。
 * 没截止日期的老任务不在这儿（在计划页和科目页里还在），所以列表底部留了一句话说明去处。
 *
 * 页面本身只排版，判断全在 lib 里：目标用 goalOf、今天的课用 todayCourses、
 * 明天用 tomorrowCourses / tomorrowTasks、完成环用 todayTotals、连续天数用 streak
 * —— 都有纯函数测试撑着。
 */
export default function Home({
  todos,
  setTodos,
  subjects,
  dueItems,
  goals,
  stages,
  courses,
  semesterStart,
  moods,
  setMoods,
  onOpenSubject,
  onOpenGoal,
  onOpenPlan,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false)
  // 正在编辑的那条任务：点行正文进来，面板关掉就清空
  const [editing, setEditing] = useState<Todo | null>(null)
  // 记住上次选的科目，下次打开面板直接站在那个科目上
  const [lastSubjectId, setLastSubjectId] = useStoredState<string>(KEYS.lastSubject, '')

  // 面板里只列真科目；未分类是历史数据的归宿，不是可选项
  const pickable = subjects.filter(subject => subject.id !== UNCATEGORIZED_ID)
  const defaultSubjectId = pickable.some(subject => subject.id === lastSubjectId)
    ? lastSubjectId
    : ''

  const today = dayKey()
  const mood = moodOf(moods, today)
  // 首页只看当前阶段：阶段之间允许重叠时，取结束得更近的那个
  const stage = currentStage(stages)
  const stageGoals = stage ? goalsOfStage(goals, stage.id) : []
  const classes = todayCourses(courses, semesterStart)
  const totals = todayTotals(todos)
  const days = streak(todos)
  const todayList = sortForPlan(todayTasks(todos))
  const doneCount = todayList.filter(todo => todo.done).length
  // 明天：课按明天的学期周次筛（跨周时单双周会翻面），任务只要没做完的
  const classesTomorrow = tomorrowCourses(courses, semesterStart)
  const tasksTomorrow = tomorrowTasks(todos)

  function handleAdd(text: string, subjectId: string, dueDate: string, kind: TodoKind) {
    setTodos(list => addTodo(list, text, subjectId, dueDate, kind))
    // 琐事不归属科目，别把「上次选的科目」覆盖成空的
    if (kind === 'study') setLastSubjectId(subjectId)
    setPanelOpen(false)
  }

  return (
    <>
      <div className="page page--fab">
        <h2 className="page__title">首页</h2>
        <p className="page__hint">{todayLabel()} · 今天的任务</p>

        <HomeGoal stage={stage} goals={stageGoals} onOpenGoal={onOpenGoal} />

        <DueSoon items={dueItems} subjects={subjects} onOpenSubject={onOpenSubject} />

        <TodayCourses items={classes} />

        <HomeStats done={totals.done} total={totals.total} percent={totals.percent} streak={days} />

        <TaskList
          todos={todayList}
          empty="今天没有要做的任务，点右下角的 + 加一条"
          onToggle={id => setTodos(list => toggleTodo(list, id))}
          onRemove={id => setTodos(list => removeTodo(list, id))}
          onEdit={id => setEditing(todos.find(todo => todo.id === id) ?? null)}
        />

        {todayList.length > 0 && (
          <div className="footer-bar">
            <span className="meta">
              今天 {todayList.length} 条，已完成 {doneCount} 条
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setTodos(list => clearDone(list))}
              disabled={todos.every(todo => !todo.done)}
            >
              清空已完成
            </button>
          </div>
        )}

        <p className="meta">
          只显示今天到期和逾期的任务；没日期的旧任务、下周的活都在「计划 · 任务」里。
        </p>

        <TomorrowBlock
          courses={classesTomorrow}
          tasks={tasksTomorrow}
          onOpenPlan={onOpenPlan}
        />

        <MoodPicker value={mood} onPick={value => setMoods(list => setMood(list, today, value))} />
      </div>

      <button
        type="button"
        className="fab"
        onClick={() => setPanelOpen(true)}
        aria-label="添加任务"
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {panelOpen && (
        <AddTaskPanel
          subjects={pickable}
          defaultSubjectId={defaultSubjectId}
          onClose={() => setPanelOpen(false)}
          onSubmit={handleAdd}
        />
      )}

      {editing && (
        <AddTaskPanel
          subjects={pickable}
          todo={editing}
          onClose={() => setEditing(null)}
          onSubmit={(text, subjectId, dueDate, kind) => {
            setTodos(list => updateTodo(list, editing.id, { text, subjectId, dueDate, kind }))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
