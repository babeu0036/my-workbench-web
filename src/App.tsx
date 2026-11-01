import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Plan from './pages/Plan'
import SubjectPage from './pages/Subject'
import ReviewData from './pages/ReviewData'
import ReviewGoal from './pages/ReviewGoal'
import Settings from './pages/Settings'
import { KEYS, useStoredState } from './lib/storage'
import { DEFAULT_SUBJECTS } from './lib/seed'
import { normalizeCourses } from './lib/courses'
import { normalizeDeadlines } from './lib/deadlines'
import { pendingReminders } from './lib/due'
import { normalizeGoals } from './lib/goals'
import { normalizeMoods } from './lib/mood'
import type { MoodMap } from './lib/mood'
import { startSync } from './lib/sync'
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME, normalizeTodos } from './lib/todos'
import type { Course, Deadline, Goal, Route, Subject, Todo } from './lib/types'

/** 手机顶栏显示当前页名，省得用户不知道自己点进来了哪 */
function titleOf(route: Route, subjects: Subject[]): string {
  switch (route.page) {
    case 'home':
      return '首页'
    case 'plan':
      return '计划'
    case 'subject':
      return subjects.find(item => item.id === route.id)?.name ?? '科目'
    case 'review':
      return '复盘'
    case 'settings':
      return '设置'
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>({ page: 'home' })

  // 打开页面就接上云同步：云端有新数据会拉下来，本地改动会自动推上去
  useEffect(() => {
    startSync()
  }, [])
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 数据仍然放在最外层：切页会卸载页面组件，数据留在这里才不会反复读盘。
  // todos 读盘时补一遍字段：老数据没有 subjectId 的归到「未分类」，不丢。
  const [todos, setTodos] = useStoredState<Todo[]>(KEYS.todos, [], normalizeTodos)
  // deadlines 读盘时把老的 `date` 搬成「报名截止」，老条目一条都不丢
  const [deadlines, setDeadlines] = useStoredState<Deadline[]>(
    KEYS.deadlines,
    [],
    normalizeDeadlines,
  )
  const [goals, setGoals] = useStoredState<Goal[]>(KEYS.goals, [], normalizeGoals)
  // 课程表：课程数组 + 学期第 1 周的周一（决定「现在是第几周」，进而决定单双周和灰色）
  const [courses, setCourses] = useStoredState<Course[]>(KEYS.courses, [], normalizeCourses)
  const [semesterStart, setSemesterStart] = useStoredState<string>(KEYS.semesterStart, '')
  // 今日状态：首页写、复盘页读，所以放在最外层，两边看到的是同一份
  const [moods, setMoods] = useStoredState<MoodMap>(KEYS.mood, {}, normalizeMoods)

  // 科目暂时是三份写死的种子数据；有未分类任务时才在「科目」下多挂一项
  // （琐事的 subjectId 也是空的，但它不属于「未分类」，别让侧边栏为它多出一项）
  const hasUnclassified = todos.some(todo => !todo.subjectId && todo.kind !== 'chore')
  const subjects: Subject[] = hasUnclassified
    ? [...DEFAULT_SUBJECTS, { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME }]
    : DEFAULT_SUBJECTS

  // 到期提醒只算一次，首页卡片和侧边栏角标共用，数字不会对不上
  const dueItems = pendingReminders(todos)

  const navigate = (next: Route) => {
    setRoute(next)
    // 手机上点完任意一项就把抽屉收起来
    setDrawerOpen(false)
  }

  return (
    <div className="app">
      <Sidebar
        route={route}
        subjects={subjects}
        dueCount={dueItems.length}
        open={drawerOpen}
        onNavigate={navigate}
        onClose={() => setDrawerOpen(false)}
      />

      {drawerOpen && (
        <div className="drawer-mask" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      <div className="app__body">
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu"
            onClick={() => setDrawerOpen(true)}
            aria-label="打开导航"
            aria-expanded={drawerOpen}
            aria-controls="sidebar"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M3.5 6h13M3.5 10h13M3.5 14h13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span className="topbar__title">{titleOf(route, subjects)}</span>

          {/* 手机上侧边栏是收起来的，顶栏留一个角标，在别的页面也知道该回去处理 */}
          {route.page !== 'home' && dueItems.length > 0 && (
            <button
              type="button"
              className="topbar__badge"
              onClick={() => navigate({ page: 'home' })}
              aria-label={`${dueItems.length} 件任务临近截止，回首页查看`}
            >
              {dueItems.length}
            </button>
          )}
        </header>

        <main className="app__main">
          {route.page === 'home' && (
            <Home
              todos={todos}
              setTodos={setTodos}
              subjects={subjects}
              dueItems={dueItems}
              goals={goals}
              courses={courses}
              semesterStart={semesterStart}
              moods={moods}
              setMoods={setMoods}
              onOpenSubject={id => navigate({ page: 'subject', id, seg: 'tasks' })}
              onOpenGoal={() => navigate({ page: 'review', block: 'goal' })}
              onOpenPlan={() => navigate({ page: 'plan', seg: 'tasks' })}
            />
          )}

          {route.page === 'plan' && (
            <Plan
              seg={route.seg}
              todos={todos}
              setTodos={setTodos}
              subjects={subjects}
              deadlines={deadlines}
              setDeadlines={setDeadlines}
              courses={courses}
              setCourses={setCourses}
              semesterStart={semesterStart}
              setSemesterStart={setSemesterStart}
            />
          )}

          {route.page === 'subject' && (
            <SubjectPage
              subject={subjects.find(item => item.id === route.id)}
              seg={route.seg}
              todos={todos}
              setTodos={setTodos}
              onSegChange={seg => setRoute({ page: 'subject', id: route.id, seg })}
            />
          )}

          {/* 复盘拆成两个独立页面：数据只看统计，目标只管目标 */}
          {route.page === 'review' && route.block === 'data' && (
            <ReviewData todos={todos} moods={moods} />
          )}

          {route.page === 'review' && route.block === 'goal' && (
            <ReviewGoal goals={goals} setGoals={setGoals} />
          )}

          {route.page === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  )
}
