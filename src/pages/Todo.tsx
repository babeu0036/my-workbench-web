import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Todo } from '../lib/types'

type Props = {
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
}

export default function TodoPage({ todos, setTodos }: Props) {
  const [text, setText] = useState('')

  const total = todos.length
  const doneCount = todos.filter(t => t.done).length

  function add() {
    const value = text.trim()
    if (!value) return
    setTodos(list => [...list, { id: Date.now(), text: value, done: false }])
    setText('')
  }

  function toggle(id: number) {
    setTodos(list => list.map(t => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function remove(id: number) {
    setTodos(list => list.filter(t => t.id !== id))
  }

  function clearDone() {
    setTodos(list => list.filter(t => !t.done))
  }

  return (
    <div className="page">
      <div className="field-row">
        <input
          className="input"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add()
          }}
          placeholder="写一件要做的事…"
          aria-label="待办内容"
        />
        <button type="button" className="btn btn--primary" onClick={add}>
          添加
        </button>
      </div>

      {todos.length === 0 ? (
        <p className="empty">还没有待办，加一条试试。</p>
      ) : (
        <ul className="list">
          {todos.map(t => (
            <li key={t.id} className="row row--todo">
              <button
                type="button"
                className={t.done ? 'check check--on' : 'check'}
                onClick={() => toggle(t.id)}
                aria-label={t.done ? '标记为未完成' : '标记为已完成'}
              >
                {t.done ? '✓' : ''}
              </button>

              <span className={t.done ? 'row__text row__text--done' : 'row__text'}>{t.text}</span>

              <span className="row__actions">
                <button type="button" className="btn btn--ghost" onClick={() => toggle(t.id)}>
                  {t.done ? '撤销' : '完成'}
                </button>
                <button type="button" className="btn btn--ghost btn--danger" onClick={() => remove(t.id)}>
                  删除
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="footer-bar">
        <span className="meta">
          共 {total} 条，已完成 {doneCount} 条
        </span>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={clearDone}
          disabled={doneCount === 0}
        >
          清空已完成
        </button>
      </div>
    </div>
  )
}
