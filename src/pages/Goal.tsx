import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AchievementCard from '../components/AchievementCard'
import AchievementForm from '../components/AchievementForm'
import ReviewGoal from '../components/ReviewGoal'
import {
  addAchievement,
  detachTasks,
  forAchievement,
  removeAchievement,
} from '../lib/achievements'
import { addAchievementTodo, removeTodo, toggleTodo, updateTodo } from '../lib/todos'
import type { Achievement, Goal as GoalItem, Todo } from '../lib/types'

type Props = {
  /** 全部任务。这个页面是唯一看得见成就任务的地方 */
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  achievements: Achievement[]
  setAchievements: Dispatch<SetStateAction<Achievement[]>>
  /** 最上面那行最终目标，空字符串 = 还没写 */
  vision: string
  setVision: Dispatch<SetStateAction<string>>
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
 * 本周目标那一段直接引用 ReviewGoal（原来是「复盘 · 目标」页），
 * 时间关系和结算规则都留在那个组件里，这里不重复一份。
 */
export default function Goal({
  todos,
  setTodos,
  achievements,
  setAchievements,
  vision,
  setVision,
  goals,
  setGoals,
}: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingVision, setEditingVision] = useState(false)
  const [visionDraft, setVisionDraft] = useState('')

  function startEditVision() {
    setVisionDraft(vision)
    setEditingVision(true)
  }

  function commitVision() {
    setVision(visionDraft.trim())
    setEditingVision(false)
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

  return (
    <>
      <div className="page page--fab">
        <h2 className="page__title">目标</h2>

        <section className="final" aria-label="最终目标">
          <span className="final__label">最终目标</span>

          {editingVision ? (
            <span className="final__edit">
              <input
                className="input final__input"
                value={visionDraft}
                onChange={event => setVisionDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') commitVision()
                  if (event.key === 'Escape') setEditingVision(false)
                }}
                placeholder="想做成的那件大事…"
                aria-label="最终目标"
                maxLength={120}
                autoFocus
              />
              <button type="button" className="btn btn--primary final__save" onClick={commitVision}>
                保存
              </button>
            </span>
          ) : (
            <>
              <span className={vision ? 'final__text' : 'final__text final__text--empty'}>
                {vision || '还没写最终目标'}
              </span>
              <button type="button" className="btn btn--ghost final__btn" onClick={startEditVision}>
                编辑
              </button>
            </>
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
              onEditTask={(id, text, dueDate) =>
                setTodos(list => updateTodo(list, id, { text, dueDate }))
              }
              onRemove={() => removeOne(item.id)}
            />
          ))
        )}

        <ReviewGoal goals={goals} setGoals={setGoals} />
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
