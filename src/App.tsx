import { useState } from 'react'
import TabBar from './components/TabBar'
import Today from './pages/Today'
import Plan from './pages/Plan'
import Focus from './pages/Focus'
import Profile from './pages/Profile'
import { KEYS, useStoredState } from './lib/storage'
import type { Deadline, Note, TabKey, Todo } from './lib/types'

export default function App() {
  const [tab, setTab] = useState<TabKey>('today')

  // 数据放在最外层：切 Tab 会卸载页面组件，数据留在这里才不会反复读盘
  const [todos, setTodos] = useStoredState<Todo[]>(KEYS.todos, [])
  const [deadlines, setDeadlines] = useStoredState<Deadline[]>(KEYS.deadlines, [])
  const [notes, setNotes] = useStoredState<Note[]>(KEYS.notes, [])

  const pendingCount = todos.filter(t => !t.done).length

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">我的工作台</h1>
      </header>

      <TabBar active={tab} onChange={setTab} todoBadge={pendingCount} />

      <main className="app__main">
        {tab === 'today' && <Today />}
        {tab === 'plan' && (
          <Plan
            todos={todos}
            setTodos={setTodos}
            deadlines={deadlines}
            setDeadlines={setDeadlines}
            notes={notes}
            setNotes={setNotes}
          />
        )}
        {tab === 'focus' && <Focus />}
        {tab === 'profile' && <Profile />}
      </main>
    </div>
  )
}
