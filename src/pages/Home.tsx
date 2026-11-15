import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import ActiveMilestones from '../components/ActiveMilestones'
import AddTaskPanel from '../components/AddTaskPanel'
import CareerCard from '../components/CareerCard'
import DueSoon from '../components/DueSoon'
import HomeStats from '../components/HomeStats'
import MoodPicker from '../components/MoodPicker'
import StageBar from '../components/StageBar'
import TaskList from '../components/TaskList'
import TodayCourses from '../components/TodayCourses'
import TomorrowBlock from '../components/TomorrowBlock'
import { todayCourses, tomorrowCourses } from '../lib/courses'
import { dayKey, todayLabel, weekKeyOf, weekKeyOffset } from '../lib/date'
import { currentStage, sortStages } from '../lib/stages'
import { activeMilestones, evidenceStats } from '../lib/milestones'
import type { MilestoneOption } from '../lib/milestones'
import { moodOf, setMood } from '../lib/mood'
import type { MoodMap } from '../lib/mood'
import { streak, todayTasks, todayTotals } from '../lib/stats'
import { KEYS, useStoredState } from '../lib/storage'
import {
  UNCATEGORIZED_ID,
  addTodo,
  clearDone,
  removeTodo,
  nextWeekMilestoneTasks,
  sortForPlan,
  tomorrowTasks,
  toggleTodo,
  updateTodo,
} from '../lib/todos'
import type {
  Achievement,
  Career,
  Course,
  Stage,
  Subject,
  Todo,
  TodoKind,
} from '../lib/types'

type Props = {
  todos: Todo[]
  /** 完整的任务（含目标页的里程碑任务）—— 只用来算里程碑进度，不进下面任何一个列表 */
  milestoneTodos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  subjects: Subject[]
  /** 该提醒的任务，最急的在前；在 App 里算好传进来，侧边栏角标用的是同一份 */
  dueItems: Todo[]
  /** 里程碑卡和「服务于」都从这里取 */
  achievements: Achievement[]
  milestones: MilestoneOption[]
  /** 职业目标：一句话愿景 + 角色 + 目标日期 */
  career: Career
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
 * 首页。从上到下：职业目标 → 当前阶段条 → 进行中的里程碑
 * → 到期提醒 → 今天有课 → 今日进度 → 今天的任务 → 明天 → 今日状态。
 *
 * 前三块把「以后要做什么」和「今天做什么」接在一起：
 * 里程碑的进度是下面那些任务勾出来的，勾一条，上面立刻变。
 *
 * 以前夹在里程碑和提醒之间还有一张「阶段目标」卡，读的是已经不存在的
 * 目标条目；目标条目并进里程碑之后那张卡永远是空的，就一起删了。
 *
 * 任务列表只放「今天到期 + 逾期」：标题写「今天的任务」就得真只放今天的。
 * 没截止日期的老任务不在这儿（在计划页和科目页里还在），所以列表底部留了一句话说明去处。
 *
 * 页面本身只排版，判断全在 lib 里：今天的课用 todayCourses、
 * 明天用 tomorrowCourses / tomorrowTasks、完成环用 todayTotals、连续天数用 streak、
 * 里程碑进度和进行中那几条用 activeMilestones —— 都有纯函数测试撑着。
 */
export default function Home({
  todos,
  milestoneTodos,
  setTodos,
  subjects,
  dueItems,
  achievements,
  milestones,
  career,
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
  // 阶段条上的「第 N 阶段」按页面上的先后算，跟目标页的顺序一致
  const stageIndex = stage ? sortStages(stages).findIndex(item => item.id === stage.id) + 1 : 0
  const active = activeMilestones(achievements, milestoneTodos, stage?.id)
  const classes = todayCourses(courses, semesterStart)
  const totals = todayTotals(todos)
  const days = streak(todos)
  const todayList = sortForPlan(todayTasks(todos))
  const doneCount = todayList.filter(todo => todo.done).length
  // 明天：课按明天的学期周次筛（跨周时单双周会翻面），任务只要没做完的
  const classesTomorrow = tomorrowCourses(courses, semesterStart)
  const tasksTomorrow = tomorrowTasks(todos)
  // 下周（周一起算）里排在里程碑上的事 —— 复盘点「下周做它」生成的就落在这里
  const nextWeekKey = weekKeyOffset(weekKeyOf(), 1)
  const nextWeekList = nextWeekMilestoneTasks(todos, nextWeekKey, weekKeyOffset(nextWeekKey, 1))
  // 「已拿下 X / Y 个证据」：个人兴趣那几条不算（见 evidenceStats）
  const evidence = evidenceStats(achievements)

  function handleAdd(
    text: string,
    subjectId: string,
    dueDate: string,
    kind: TodoKind,
    goalId: number | undefined,
  ) {
    setTodos(list => addTodo(list, text, subjectId, dueDate, kind, goalId))
    // 琐事不归属科目，别把「上次选的科目」覆盖成空的
    if (kind === 'study') setLastSubjectId(subjectId)
    setPanelOpen(false)
  }

  return (
    <>
      <div className="page page--fab">
        <h2 className="page__title">首页</h2>
        <p className="page__hint">{todayLabel()} · 今天的任务</p>

        <CareerCard
          career={career}
          evidence={evidence}
          onOpen={onOpenGoal}
        />

        <StageBar stage={stage} index={stageIndex} />

        <ActiveMilestones rows={active} onOpen={onOpenGoal} />

        <DueSoon items={dueItems} subjects={subjects} onOpenSubject={onOpenSubject} />

        <TodayCourses items={classes} />

        <HomeStats done={totals.done} total={totals.total} percent={totals.percent} streak={days} />

        <TaskList
          todos={todayList}
          empty="今天没有要做的任务，点右下角的 + 加一条"
          milestones={milestones}
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

        {/* 复盘排进来的事得在首页看得见，否则「闭环」缺最后一格：
            首页本来只列今天到期和逾期，下周的活不在里面 */}
        {nextWeekList.length > 0 && (
          <section className="card nextweek" aria-labelledby="nextweek-title">
            <div className="card__head">
              <span className="card__title" id="nextweek-title">
                下周要做
              </span>
              <button type="button" className="btn btn--ghost nextweek__more" onClick={onOpenPlan}>
                全部
              </button>
            </div>
            <TaskList
              todos={nextWeekList}
              empty=""
              milestones={milestones}
              onToggle={id => setTodos(list => toggleTodo(list, id))}
              onRemove={id => setTodos(list => removeTodo(list, id))}
            />
          </section>
        )}

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
          milestones={milestones}
          onClose={() => setPanelOpen(false)}
          onSubmit={handleAdd}
        />
      )}

      {editing && (
        <AddTaskPanel
          subjects={pickable}
          todo={editing}
          milestones={milestones}
          onClose={() => setEditing(null)}
          onSubmit={(text, subjectId, dueDate, kind, goalId) => {
            setTodos(list =>
              updateTodo(list, editing.id, { text, subjectId, dueDate, kind, goalId: goalId ?? null }),
            )
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
