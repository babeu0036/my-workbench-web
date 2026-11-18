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
import { EMPTY_CAREER, normalizeCareer } from './lib/career'
import { normalizeCourses } from './lib/courses'
import { normalizeDeadlines } from './lib/deadlines'
import { pendingReminders } from './lib/due'
import { normalizeStages } from './lib/stages'
import { normalizeAchievements } from './lib/achievements'
import { milestoneOptions } from './lib/milestones'
import { normalizeKnowledgeList } from './lib/knowledge'
import { normalizeFeedCache } from './lib/feed'
import { normalizeMoods } from './lib/mood'
import type { MoodMap } from './lib/mood'
import { normalizeReviews } from './lib/reviews'
import { addGenerated, thisWeekKey } from './lib/reviews'
import { startSync } from './lib/sync'
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME, nextId, normalizeTodos, plannedTodo, withoutAchievement } from './lib/todos'
import type {
  Achievement,
  Career,
  Course,
  Deadline,
  FeedCache,
  Knowledge as KnowledgeItem,
  Review,
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
  // 阶段是目标页唯一的时间轴：里程碑都挂在它下面
  const [stages, setStages] = useStoredState<Stage[]>(KEYS.stages, [], normalizeStages)
  // 目标页：里程碑（含从老「目标条目」搬进来的那些）
  const [achievements, setAchievements] = useStoredState<Achievement[]>(
    KEYS.achievements,
    [],
    normalizeAchievements,
  )
  // 职业目标：一句话愿景 + 角色 + 目标日期。首页顶部那张卡和目标页最上面那块共用这份
  const [career, setCareer] = useStoredState<Career>(KEYS.career, EMPTY_CAREER, normalizeCareer)
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
  // 每周复盘：一周一条，认 weekStart。以 workbench. 开头，跟着云同步一起走
  const [reviews, setReviews] = useStoredState<Review[]>(KEYS.reviews, [], normalizeReviews)

  // 里程碑任务只活在目标页：计划·任务、首页、复盘统计都只算这一份，
  // 否则同一件事会在三处各算一遍，数字还对不上。
  // 注意「服务于」的软关联任务（goalId）仍然留在这份里 —— 它们要出现在首页和计划，
  // 只是同时算进里程碑进度，所以首页算进度时还得看完整的 todos。
  const mainTodos = withoutAchievement(todos)

  // 科目暂时是三份写死的种子数据；有未分类任务时科目筛选条才多挂一项
  // （琐事的 subjectId 也是空的，但它不属于「未分类」，别为它多出一个胶囊）
  const hasUnclassified = mainTodos.some(todo => !todo.subjectId && todo.kind !== 'chore')
  const subjects: Subject[] = hasUnclassified
    ? [...DEFAULT_SUBJECTS, { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME }]
    : DEFAULT_SUBJECTS

  // 到期提醒只算一次，首页卡片和侧边栏角标共用，数字不会对不上
  const dueItems = pendingReminders(mainTodos)

  // 「服务于」的选项：每条里程碑 + 它属于哪个阶段。算一次，首页 / 计划 / 科目页共用
  const milestones = milestoneOptions(achievements, stages)

  // 科目页兜底：这个 id 可能已经不存在了（科目被删 / 老数据带过来的），
  // 拿不到 subject 就不渲染科目页，换一张「没找到 + 返回首页」的卡，不留白屏
  const subjectOfRoute =
    route.page === 'subject' ? subjects.find(item => item.id === route.id) : undefined

  const navigate = (next: Route) => {
    setRoute(next)
    // 手机上点完任意一项就把抽屉收起来
    setDrawerOpen(false)
  }

  /**
   * 复盘里点「下周做它」：生成一条挂在里程碑上的待办，并把 todoId 记进本周复盘。
   *
   * id 按当前数据先算好，两个 setState 才指向同一条 —— 它们在这个事件里一起排队，
   * 用户看到的是「任务排进下周」和「按钮变成已加入下周」同时发生。
   * 任务用 goalId 软关联（见 plannedTodo 的注释），所以首页 / 计划里也看得见。
   *
   * 已经有一条「同一条里程碑、同样的话、还没做完」的任务就不再建 —— 直接把那条
   * 的 id 记进复盘，按钮照样变成已加入下周，列表里不会多出一条一模一样的。
   */
  const planNextWeek = (
    achievementId: number,
    text: string,
    dueDate: string,
    snapshot: { movedCount: number; totalCount: number },
  ) => {
    const now = Date.now()
    const value = text.trim()
    const existing = todos.find(
      todo =>
        !todo.done &&
        todo.text === value &&
        (todo.goalId === achievementId || todo.achievementId === achievementId),
    )
    if (existing) {
      setReviews(list =>
        addGenerated(list, thisWeekKey(now), { achievementId, todoId: existing.id }, snapshot, now),
      )
      return
    }

    const todoId = nextId(todos, now)
    setTodos(list => [...list, plannedTodo(todoId, value, achievementId, dueDate, now)])
    setReviews(list => addGenerated(list, thisWeekKey(now), { achievementId, todoId }, snapshot, now))
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
              milestoneTodos={todos}
              setTodos={setTodos}
              subjects={subjects}
              dueItems={dueItems}
              achievements={achievements}
              milestones={milestones}
              career={career}
              stages={stages}
              courses={courses}
              semesterStart={semesterStart}
              moods={moods}
              setMoods={setMoods}
              // 科目不存在（没科目 / 已被删）就不跳：宁可不响应，也别把人送进「没有此科目」的页面
              onOpenSubject={id => {
                if (!subjects.some(item => item.id === id)) return
                navigate({ page: 'subject', id })
              }}
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
              milestones={milestones}
              deadlines={deadlines}
              setDeadlines={setDeadlines}
              courses={courses}
              setCourses={setCourses}
              semesterStart={semesterStart}
              setSemesterStart={setSemesterStart}
            />
          )}

          {route.page === 'subject' &&
            (subjectOfRoute ? (
              <SubjectPage
                subject={subjectOfRoute}
                subjects={subjects}
                todos={mainTodos}
                setTodos={setTodos}
                milestones={milestones}
              />
            ) : (
              <div className="page">
                <h2 className="page__title">科目</h2>
                <div className="card">
                  <div className="empty-block">
                    <p className="empty">没找到这个科目</p>
                    <p className="meta">它可能已经被删掉了。回首页继续处理今天的任务吧。</p>
                    <button
                      type="button"
                      className="btn btn--primary"
                      style={{ marginTop: 4 }}
                      onClick={() => navigate({ page: 'home' })}
                    >
                      返回首页
                    </button>
                  </div>
                </div>
              </div>
            ))}

          {/* 复盘：本周一句话 → 没动的里程碑 → 三句话 → 以前的周 */}
          {route.page === 'review' && (
            <ReviewData
              todos={todos}
              achievements={achievements}
              stages={stages}
              reviews={reviews}
              setReviews={setReviews}
              onPlanNextWeek={planNextWeek}
            />
          )}

          {/* 目标页：职业目标 → 阶段（每个阶段里是里程碑卡）；里程碑下的任务只在这一页出现 */}
          {route.page === 'goal' && (
            <GoalPage
              todos={todos}
              setTodos={setTodos}
              achievements={achievements}
              setAchievements={setAchievements}
              career={career}
              setCareer={setCareer}
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
