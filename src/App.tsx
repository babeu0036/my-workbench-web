import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Plan from './pages/Plan'
import SubjectPage from './pages/Subject'
import ReviewData from './pages/ReviewData'
import Settings from './pages/Settings'
// 页面组件叫 GoalPage，避开 lib/types 里那个 Goal 类型
import GoalPage from './pages/Goal'
import Knowledge from './pages/Knowledge'
import { KEYS, useStoredState } from './lib/storage'
import { DEFAULT_SUBJECTS } from './lib/seed'
import { normalizeCourses } from './lib/courses'
import { normalizeDeadlines } from './lib/deadlines'
import { pendingReminders } from './lib/due'
import { normalizeGoals } from './lib/goals'
import { normalizeStages } from './lib/stages'
import { normalizeAchievements, withLitState } from './lib/achievements'
import { normalizeKnowledgeList } from './lib/knowledge'
import { normalizeFeedCache } from './lib/feed'
import { normalizeMoods } from './lib/mood'
import type { MoodMap } from './lib/mood'
import { startSync } from './lib/sync'
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME, normalizeTodos, withoutAchievement } from './lib/todos'
import type {
  Achievement,
  Course,
  Deadline,
  FeedCache,
  Goal,
  Knowledge as KnowledgeItem,
  Route,
  Stage,
  Subject,
  Todo,
} from './lib/types'

/** 手机顶栏显示当前页名，省得用户不知道自己点进来了哪 */
function titleOf(route: Route, subjects: Subject[]): string {
  switch (route.page) {
    case 'home':
      return '首页'
    case 'plan':
      return '计划'
    case 'goal':
      return '目标'
    case 'knowledge':
      return '知识库'
    // 科目页暂时没有侧边栏入口，只剩首页提醒卡点科目名能进来
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
  // 目标：一个阶段（大一上 / 大一下 / …）下挂若干条，首页只读当前阶段那几条
  const [goals, setGoals] = useStoredState<Goal[]>(KEYS.goals, [], normalizeGoals)
  // 阶段是目标页唯一的时间轴：目标条目和成就都挂在它下面
  const [stages, setStages] = useStoredState<Stage[]>(KEYS.stages, [], normalizeStages)
  // 目标页：成就 + 最上面那行最终目标
  const [achievements, setAchievements] = useStoredState<Achievement[]>(
    KEYS.achievements,
    [],
    normalizeAchievements,
  )
  // 目标页最上面那行「最终目标」，空字符串 = 还没写
  const [vision, setVision] = useStoredState<string>(KEYS.vision, '', value =>
    typeof value === 'string' ? value : '',
  )
  // 知识库：学习资料 / 行业动态 / 我的笔记，搜索和筛选不落盘
  const [knowledge, setKnowledge] = useStoredState<KnowledgeItem[]>(
    KEYS.knowledge,
    [],
    normalizeKnowledgeList,
  )
  // 行业动态的缓存：拉一次管 30 分钟，拉失败时继续用旧内容
  const [feedCache, setFeedCache] = useStoredState<FeedCache>(
    KEYS.feedCache,
    { fetchedAt: 0, items: [] },
    normalizeFeedCache,
  )
  // 课程表：课程数组 + 学期第 1 周的周一（决定「现在是第几周」，进而决定单双周和灰色）
  const [courses, setCourses] = useStoredState<Course[]>(KEYS.courses, [], normalizeCourses)
  const [semesterStart, setSemesterStart] = useStoredState<string>(KEYS.semesterStart, '')
  // 今日状态：首页写、复盘页读，所以放在最外层，两边看到的是同一份
  const [moods, setMoods] = useStoredState<MoodMap>(KEYS.mood, {}, normalizeMoods)

  // 成就任务只活在目标页：计划·任务、首页、复盘统计都只算这一份，
  // 否则同一件事会在三处各算一遍，数字还对不上
  const mainTodos = withoutAchievement(todos)

  // 自动点亮 / 熄灭。withLitState 没有变化时返回原数组，setState 一比较就跳过，
  // 所以这里不会自己触发自己
  useEffect(() => {
    setAchievements(list => withLitState(list, todos))
  }, [todos, setAchievements])

  // 科目暂时是三份写死的种子数据；有未分类任务时科目筛选条才多挂一项
  // （琐事的 subjectId 也是空的，但它不属于「未分类」，别为它多出一个胶囊）
  const hasUnclassified = mainTodos.some(todo => !todo.subjectId && todo.kind !== 'chore')
  const subjects: Subject[] = hasUnclassified
    ? [...DEFAULT_SUBJECTS, { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME }]
    : DEFAULT_SUBJECTS

  // 到期提醒只算一次，首页卡片和侧边栏角标共用，数字不会对不上
  const dueItems = pendingReminders(mainTodos)

  const navigate = (next: Route) => {
    setRoute(next)
    // 手机上点完任意一项就把抽屉收起来
    setDrawerOpen(false)
  }

  return (
    <div className="app">
      <Sidebar
        route={route}
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
              todos={mainTodos}
              setTodos={setTodos}
              subjects={subjects}
              dueItems={dueItems}
              goals={goals}
              stages={stages}
              courses={courses}
              semesterStart={semesterStart}
              moods={moods}
              setMoods={setMoods}
              onOpenSubject={id => navigate({ page: 'subject', id, seg: 'tasks' })}
              onOpenGoal={() => navigate({ page: 'goal' })}
              onOpenPlan={() => navigate({ page: 'plan', seg: 'tasks' })}
            />
          )}

          {route.page === 'plan' && (
            <Plan
              seg={route.seg}
              todos={mainTodos}
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
              subjects={subjects}
              seg={route.seg}
              todos={mainTodos}
              setTodos={setTodos}
              onSegChange={seg => setRoute({ page: 'subject', id: route.id, seg })}
            />
          )}

          {/* 复盘只剩一页（原来的「数据」），不再有二级结构 */}
          {route.page === 'review' && <ReviewData todos={mainTodos} moods={moods} />}

          {/* 目标页：最终目标 → 目标条目 → 阶段（内含成就）；成就下的任务只在这一页出现 */}
          {route.page === 'goal' && (
            <GoalPage
              todos={todos}
              setTodos={setTodos}
              achievements={achievements}
              setAchievements={setAchievements}
              vision={vision}
              setVision={setVision}
              goals={goals}
              setGoals={setGoals}
              stages={stages}
              setStages={setStages}
            />
          )}
          {route.page === 'knowledge' && (
            <Knowledge
              items={knowledge}
              setItems={setKnowledge}
              feed={feedCache}
              setFeed={setFeedCache}
            />
          )}

          {route.page === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  )
}
