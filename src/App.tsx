import { useState } from 'react'
import TabBar from './components/TabBar'
import Home from './pages/Home'
import TodoPage from './pages/Todo'
import Deadlines from './pages/Deadlines'
import { KEYS, useStoredState } from './lib/storage'
import type { Deadline, TabKey, Todo } from './lib/types'

export default function App() {
  const [tab, setTab] = useState<TabKey>('home')

  // 数据放在最外层，首页要读、子页面要改，都从这里传
  const [todos, setTodos] = useStoredState<Todo[]>(KEYS.todos, [])
  const [deadlines, setDeadlines] = useStoredState<Deadline[]>(KEYS.deadlines, [])

  const pendingCount = todos.filter(t => !t.done).length

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">我的工作台</h1>
      </header>

      <TabBar active={tab} onChange={setTab} todoBadge={pendingCount} />

      <main className="app__main">
        {tab === 'home' && <Home todos={todos} deadlines={deadlines} onGo={setTab} />}
        {tab === 'todo' && <TodoPage todos={todos} setTodos={setTodos} />}
        {tab === 'deadlines' && <Deadlines deadlines={deadlines} setDeadlines={setDeadlines} />}
      </main>
    </div>
  )
}
