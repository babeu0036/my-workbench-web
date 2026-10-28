import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { daysLabel, daysTone, daysUntil, formatDate } from '../lib/date'
import type { Deadline } from '../lib/types'

type Props = {
  deadlines: Deadline[]
  setDeadlines: Dispatch<SetStateAction<Deadline[]>>
}

export default function Deadlines({ deadlines, setDeadlines }: Props) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')

  function add() {
    const value = name.trim()
    if (!value) {
      setError('先写比赛名称')
      return
    }
    if (!date) {
      setError('再选一个截止日期')
      return
    }
    setDeadlines(list => [...list, { id: Date.now(), name: value, date }])
    setName('')
    setDate('')
    setError('')
  }

  function remove(id: number) {
    setDeadlines(list => list.filter(d => d.id !== id))
  }

  // 没结束的按日期从近到远在前；已结束的沉到底部，最近结束的靠上
  const sorted = [...deadlines].sort((a, b) => {
    const da = daysUntil(a.date)
    const db = daysUntil(b.date)
    const overA = !(da >= 0)
    const overB = !(db >= 0)
    if (overA !== overB) return overA ? 1 : -1
    return overA ? db - da : da - db
  })

  return (
    <div className="page">
      <div className="form">
        <input
          className="input"
          value={name}
          onChange={e => {
            setName(e.target.value)
            setError('')
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') add()
          }}
          placeholder="比赛名称，比如 蓝桥杯"
          aria-label="比赛名称"
        />
        <div className="field-row">
          <input
            className="input"
            type="date"
            value={date}
            onChange={e => {
              setDate(e.target.value)
              setError('')
            }}
            aria-label="截止日期"
          />
          <button type="button" className="btn btn--primary" onClick={add}>
            添加
          </button>
        </div>
        {error && <p className="form__error">{error}</p>}
      </div>

      {sorted.length === 0 ? (
        <p className="empty">还没有比赛，加一个 DDL 盯着。</p>
      ) : (
        <ul className="list">
          {sorted.map(item => {
            const days = daysUntil(item.date)
            const tone = daysTone(days)
            return (
              <li key={item.id} className={tone === 'over' ? 'row row--over' : 'row'}>
                <span className="row__body">
                  <span className="row__text">{item.name}</span>
                  <span className="row__date">{formatDate(item.date)}</span>
                </span>
                <span className={`pill pill--${tone}`}>{daysLabel(days)}</span>
                <button type="button" className="btn btn--ghost btn--danger" onClick={() => remove(item.id)}>
                  删除
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
