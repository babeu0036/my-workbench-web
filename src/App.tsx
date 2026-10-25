import { useEffect, useState } from 'react'

type Todo = { id: number; text: string; done?: boolean }

export default function App() {
  const [text, setText] = useState('')
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('todos')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  function add() {
    const t = text.trim()
    if (!t) return
    setTodos([...todos, { id: Date.now(), text: t }])
    setText('')
  }

  function remove(id: number) {
    setTodos(todos.filter(t => t.id !== id))
  }
  function clearall() {
    setTodos([])
  }
  function toggle(id: number) {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>我的工作台</h1>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder="写一件要做的事…"
          style={{ flex: 1, padding: 8, fontSize: 16 }}
        />
        <button onClick={add} style={{ padding: '8px 16px', fontSize: 16 }}>添加</button>
      </div>
      <ul style={{ padding: 0, listStyle: 'none', marginTop: 16 }}>
        {todos.map(t => (
          <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <span style={{ textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.4 : 1 }}>{t.text}</span>
            <button onClick={() => remove(t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1a1718ff' }}>删除</button>
            <button onClick={() => toggle(t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#812278ff' }}>{t.done ? '撤销' : '完成'}</button>
            <button onClick={clearall} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#812278ff' }}>清除所有</button>
          </li>
        ))}
      </ul>
      {todos.length === 0 && <p style={{ color: '#999' }}>还没有待办，加一条试试。</p>}
    </div>
  )
}