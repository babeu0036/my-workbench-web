import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Plan from './pages/Plan'
import SubjectPage from './pages/Subject'
import Review from './pages/Review'
import Settings from './pages/Settings'
import { KEYS, useStoredState } from './lib/storage'
import { DEFAULT_SUBJECTS } from './lib/seed'
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME, normalizeTodos } from './lib/todos'
import type { Deadline, Route, Subject, Todo } from './lib/types'

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
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 数据仍然放在最外层：切页会卸载页面组件，数据留在这里才不会反复读盘。
  // todos 读盘时补一遍字段：老数据没有 subjectId 的归到「未分类」，不丢。
  const [todos, setTodos] = useStoredState<Todo[]>(KEYS.todos, [], normalizeTodos)
  const [deadlines, setDeadlines] = useStoredState<Deadline[]>(KEYS.deadlines, [])

  // 科目暂时是三份写死的种子数据；有未分类任务时才在「科目」下多挂一项
  const hasUnclassified = todos.some(todo => !todo.subjectId)
  const subjects: Subject[] = hasUnclassified
    ? [...DEFAULT_SUBJECTS, { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME }]
    : DEFAULT_SUBJECTS

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
        </header>

        <main className="app__main">
          {route.page === 'home' && <Home todos={todos} setTodos={setTodos} />}

          {route.page === 'plan' && (
            <Plan
              seg={route.seg}
              onSegChange={seg => setRoute({ page: 'plan', seg })}
              deadlines={deadlines}
              setDeadlines={setDeadlines}
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

          {route.page === 'review' && <Review block={route.block} />}

          {route.page === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  )
}
