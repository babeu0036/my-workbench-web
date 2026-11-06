import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AchievementCard from '../components/AchievementCard'
import AchievementForm from '../components/AchievementForm'
import GoalAddPanel from '../components/GoalAddPanel'
import GoalList from '../components/GoalList'
import {
  addAchievement,
  detachTasks,
  forAchievement,
  removeAchievement,
} from '../lib/achievements'
import {
  addGoal,
  removeGoal,
  sortForGoalList,
  toggleGoal,
  updateGoal,
} from '../lib/goals'
import { addAchievementTodo, removeTodo, toggleTodo, updateTodo } from '../lib/todos'
import type { Achievement, Goal as GoalItem, GoalPeriod, Todo } from '../lib/types'

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
  /** 目标的周期：本学期 / 暑假 / 那周 …… */
  periods: GoalPeriod[]
  setPeriods: Dispatch<SetStateAction<GoalPeriod[]>>
  /** 课程表里设的学期开始，用来算「本学期」那个快捷周期 */
  semesterStart: string
}

/**
 * 目标。从上到下：最终目标一行 → 目标列表 → 成就列表。
 *
 * 目标不再按周一条：一个周期（本学期 / 暑假 / 自己起的名）下想加几条加几条，
 * 列表是扁平一列，每条前面挂个小标签写明属于哪个周期。
 * 勾上就是完成，取消就回到未完成 —— 没有「点了就锁定」那套。
 *
 * 成就还是原来的样子：卡片三态，任务只在这一页出现（见 withoutAchievement），
 * 所以这里拿到的是完整的 todos，别的页面拿的是剔过的那份。
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
  periods,
  setPeriods,
  semesterStart,
}: Props) {
  const [achievementOpen, setAchievementOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [editingVision, setEditingVision] = useState(false)
  const [visionDraft, setVisionDraft] = useState('')

  const sortedGoals = sortForGoalList(goals, periods)

  function startEditVision() {
    setVisionDraft(vision)
    setEditingVision(true)
  }

  function commitVision() {
    setVision(visionDraft.trim())
    setEditingVision(false)
  }

  /**
   * 面板里选的周期可能还不存在（点了预设或者刚自定义的）。
   * 这里按「名字 + 起止」认一下：已经有就复用它，没有才真的追加一条周期。
   */
  function addOne(text: string, period: GoalPeriod) {
    const existing = periods.find(
      item => item.title === period.title && item.start === period.start && item.end === period.end,
    )
    if (!existing) setPeriods(list => [...list, period])
    setGoals(list => addGoal(list, { periodId: existing ? existing.id : period.id, text }))
    setGoalOpen(false)
  }

  function addAchievementItem(title: string, note: string) {
    setAchievements(list => addAchievement(list, title, note))
    setAchievementOpen(false)
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
                {vision || '还没写'}
              </span>
              <button type="button" className="btn btn--ghost final__btn" onClick={startEditVision}>
                编辑
              </button>
            </>
          )}
        </section>

        <GoalList
          goals={sortedGoals}
          periods={periods}
          onToggle={id => setGoals(list => toggleGoal(list, id))}
          onUpdate={(id, text) => setGoals(list => updateGoal(list, id, text))}
          onRemove={id => setGoals(list => removeGoal(list, id))}
          onAdd={() => setGoalOpen(true)}
        />

        {goals.length > 0 && (
          <button type="button" className="goal-add" onClick={() => setGoalOpen(true)}>
            + 添加目标
          </button>
        )}

        <h3 className="goal-section">成就</h3>

        {achievements.length === 0 ? (
          <p className="placeholder__note">还没有成就，点右下角添加</p>
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
      </div>

      <button
        type="button"
        className="fab"
        onClick={() => setAchievementOpen(true)}
        aria-label="添加成就"
        aria-haspopup="dialog"
        aria-expanded={achievementOpen}
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

      {goalOpen && (
        <GoalAddPanel
          periods={periods}
          semesterStart={semesterStart}
          onClose={() => setGoalOpen(false)}
          onSubmit={addOne}
        />
      )}

      {achievementOpen && (
        <AchievementForm
          onClose={() => setAchievementOpen(false)}
          onAdd={addAchievementItem}
        />
      )}
    </>
  )
}
