import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AchievementCard from '../components/AchievementCard'
import AchievementForm from '../components/AchievementForm'
import {
  addAchievement,
  detachTasks,
  forAchievement,
  removeAchievement,
} from '../lib/achievements'
import { formatWeekRange, weekKeyOf, weekKeyOffset } from '../lib/date'
import { goalOf, saveGoal, settleGoal } from '../lib/goals'
import { addAchievementTodo, removeTodo, toggleTodo } from '../lib/todos'
import type { Achievement, Goal as GoalItem, Todo } from '../lib/types'

type Props = {
  /** 全部任务。这个页面是唯一看得见成就任务的地方 */
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  achievements: Achievement[]
  setAchievements: Dispatch<SetStateAction<Achievement[]>>
  /** 最上面那行最终目标，空字符串 = 还没写 */
  finalGoal: string
  setFinalGoal: Dispatch<SetStateAction<string>>
  goals: GoalItem[]
  setGoals: Dispatch<SetStateAction<GoalItem[]>>
}

/**
 * 目标。从上到下三段：最终目标一行 → 成就列表 → 本周目标。
 *
 * 不做「实践线 / 学业线」分组 —— 一条条平行摆着，哪条先做成先点亮。
 * 成就下面的任务只在这一页出现，计划·任务和首页都不收（见 withoutAchievement），
 * 所以这里拿到的是完整的 todos，别的页面拿的是剔过的那份。
 *
 * 本周目标这一段是从原来的「复盘 · 目标」整段搬过来的，时间关系没变：
 * 卡片上是本周目标（随时能点完成 / 没完成，点了锁定），下面输入框写的是下周。
 */
export default function Goal({
  todos,
  setTodos,
  achievements,
  setAchievements,
  finalGoal,
  setFinalGoal,
  goals,
  setGoals,
}: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingFinal, setEditingFinal] = useState(false)
  const [finalDraft, setFinalDraft] = useState('')
  const [draft, setDraft] = useState('')

  const thisWeekKey = weekKeyOf()
  const nextWeekKey = weekKeyOffset(thisWeekKey, 1)
  const current = goalOf(goals, thisWeekKey)
  const next = goalOf(goals, nextWeekKey)

  function startEditFinal() {
    setFinalDraft(finalGoal)
    setEditingFinal(true)
  }

  function commitFinal() {
    setFinalGoal(finalDraft.trim())
    setEditingFinal(false)
  }

  function addNew(title: string, note: string) {
    setAchievements(list => addAchievement(list, title, note))
    setFormOpen(false)
  }

  /** 删成就：任务不跟着删，只摘掉 achievementId，它们退回「未分类」 */
  function removeOne(id: number) {
    setAchievements(list => removeAchievement(list, id))
    setTodos(list => detachTasks(list, id))
  }

  function settle(id: number, done: boolean) {
    setGoals(list => settleGoal(list, id, done))
  }

  function save() {
    const value = draft.trim()
    if (!value) return
    // settleBefore 用本周：只收掉更早的旧目标，本周那条留给上面的按钮
    setGoals(list =>
      saveGoal(list, { text: value, weekKey: nextWeekKey, settleBefore: thisWeekKey }),
    )
    setDraft('')
  }

  return (
    <>
      <div className="page page--fab">
        <h2 className="page__title">目标</h2>

        <section className="final" aria-label="最终目标">
          <span className="final__label">最终目标</span>
          {editingFinal ? (
            <span className="final__edit">
              <input
                className="input"
                value={finalDraft}
                onChange={event => setFinalDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') commitFinal()
                  if (event.key === 'Escape') setEditingFinal(false)
                }}
                placeholder="想做成的那件大事…"
                aria-label="最终目标"
                maxLength={120}
                autoFocus
              />
              <button type="button" className="btn btn--primary" onClick={commitFinal}>
                保存
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={finalGoal ? 'final__text' : 'final__text final__text--empty'}
              onClick={startEditFinal}
            >
              {finalGoal || '还没写最终目标，点这里写'}
            </button>
          )}
        </section>

        {achievements.length === 0 ? (
          <p className="placeholder__note">还没有目标，点右下角添加</p>
        ) : (
          achievements.map(item => (
            <AchievementCard
              key={item.id}
              achievement={item}
              tasks={forAchievement(todos, item.id)}
              onToggleTask={id => setTodos(list => toggleTodo(list, id))}
              onRemoveTask={id => setTodos(list => removeTodo(list, id))}
              onAddTask={(text, dueDate) =>
                setTodos(list => addAchievementTodo(list, text, item.id, dueDate))
              }
              onRemove={() => removeOne(item.id)}
            />
          ))
        )}

        <div className="card goal">
          <div className="goal__head">
            <span className="goal__week">本周目标 · {formatWeekRange(thisWeekKey)}</span>
            {current?.settled && (
              <span className={current.done ? 'goal__state goal__state--done' : 'goal__state'}>
                已记录 · {current.done ? '完成' : '没完成'}
              </span>
            )}
          </div>

          {current ? (
            <>
              <p className="goal__text">{current.text}</p>

              <div className="goal__actions">
                <button
                  type="button"
                  className={
                    current.settled && current.done
                      ? 'btn btn--ghost goal__btn goal__btn--on'
                      : 'btn btn--ghost goal__btn'
                  }
                  disabled={current.settled}
                  onClick={() => settle(current.id, true)}
                >
                  ☑ 完成
                </button>
                <button
                  type="button"
                  className={
                    current.settled && !current.done
                      ? 'btn btn--ghost goal__btn goal__btn--on'
                      : 'btn btn--ghost goal__btn'
                  }
                  disabled={current.settled}
                  onClick={() => settle(current.id, false)}
                >
                  ☐ 没完成
                </button>
              </div>

              <p className="meta">
                {current.settled
                  ? '这周的目标已经记录，不再改判。'
                  : '点了就锁定，这周不再改判。'}
              </p>
            </>
          ) : (
            <p className="goal__empty">
              这周还没写目标。可以在下面写一条下周的，从下周一开始生效。
            </p>
          )}
        </div>

        <label className="goal__label" htmlFor="goal-input">
          下周目标 · {formatWeekRange(nextWeekKey)}
        </label>

        <div className="composer">
          <div className="composer__row">
            <input
              id="goal-input"
              className="input"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') save()
              }}
              placeholder="下周想完成什么…"
              maxLength={120}
            />
            <button
              type="button"
              className="btn btn--primary"
              onClick={save}
              disabled={!draft.trim()}
            >
              保存
            </button>
          </div>
        </div>

        <p className="meta">
          {next
            ? `下周已记下：${next.text}（再保存会覆盖这条）`
            : '一周只留一条目标；保存时会把更早、还没结算的目标一起结掉。'}
        </p>
      </div>

      <button
        type="button"
        className="fab"
        onClick={() => setFormOpen(true)}
        aria-label="添加成就"
        aria-haspopup="dialog"
        aria-expanded={formOpen}
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

      {formOpen && <AchievementForm onClose={() => setFormOpen(false)} onAdd={addNew} />}
    </>
  )
}
