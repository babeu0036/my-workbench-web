import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AchievementForm from '../components/AchievementForm'
import GoalAddPanel from '../components/GoalAddPanel'
import GoalList from '../components/GoalList'
import StageForm from '../components/StageForm'
import StageList from '../components/StageList'
import {
  addAchievement,
  detachTasks,
  markAchievementDone,
  removeAchievement,
  reopenAchievement,
  updateAchievement,
} from '../lib/achievements'
import { countdownText, targetDays } from '../lib/career'
import { addGoal, removeGoal, sortForGoalList, toggleGoal, updateGoal } from '../lib/goals'
import {
  UNSORTED_STAGE_ID,
  addStage,
  currentStage,
  nextStageOrder,
  removeStage,
  updateStage,
} from '../lib/stages'
import { addAchievementTodo, removeTodo, toggleTodo, updateTodo } from '../lib/todos'
import type { Achievement, Career, Goal as GoalItem, Stage, Todo } from '../lib/types'

type CareerField = 'vision' | 'role' | 'targetDate'

const CAREER_ROWS: { key: CareerField; label: string; placeholder: string; type: 'text' | 'date' }[] =
  [
    { key: 'vision', label: '愿景', placeholder: '想成为什么样的人、做成什么事', type: 'text' },
    { key: 'role', label: '角色', placeholder: '想去的位置，比如「后端开发实习生」', type: 'text' },
    { key: 'targetDate', label: '目标日期', placeholder: '还没定', type: 'date' },
  ]

type Props = {
  /** 全部任务。这个页面是唯一看得见成就任务的地方 */
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  achievements: Achievement[]
  setAchievements: Dispatch<SetStateAction<Achievement[]>>
  /** 职业目标：愿景 / 角色 / 目标日期。首页那张卡读的是同一份 */
  career: Career
  setCareer: Dispatch<SetStateAction<Career>>
  goals: GoalItem[]
  setGoals: Dispatch<SetStateAction<GoalItem[]>>
  /** 阶段：目标页唯一的时间轴，目标条目和成就都挂在它下面 */
  stages: Stage[]
  setStages: Dispatch<SetStateAction<Stage[]>>
}

/**
 * 目标。从上到下：职业目标（三行）→ 目标条目 → 阶段（每个阶段里是成就卡）。
 *
 * 职业目标就是首页顶部那张卡的数据源：愿景一句话、角色、目标日期。
 * 三行都是点一下就地改，改完回车或点保存，Esc 放弃 —— 跟目标条目一个手感。
 *
 * 目标条目仍然是扁平一列、每条前面挂阶段标签，**不塞进阶段里** ——
 * 阶段那一层负责成就，目标再按阶段分组就成了两层一样的结构。
 *
 * 成就按阶段折叠：当前阶段默认展开，其余收着。任务只在这一页出现
 * （见 withoutAchievement），所以这里拿到的是完整的 todos。
 */
export default function Goal({
  todos,
  setTodos,
  achievements,
  setAchievements,
  career,
  setCareer,
  goals,
  setGoals,
  stages,
  setStages,
}: Props) {
  // 打开添加成就的面板时记下预选的阶段；null = 关着
  const [addingFor, setAddingFor] = useState<{ stageId: number } | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<Stage | null>(null)
  const [careerField, setCareerField] = useState<CareerField | null>(null)
  const [careerDraft, setCareerDraft] = useState('')

  const sortedGoals = sortForGoalList(goals, stages)

  function startEditCareer(field: CareerField) {
    setCareerDraft(career[field])
    setCareerField(field)
  }

  function commitCareer() {
    if (!careerField) return
    const field = careerField
    const value = careerDraft.trim()
    setCareer(current => ({ ...current, [field]: value }))
    setCareerField(null)
  }

  /**
   * 面板里选的阶段可能还不存在（刚自定义的）。
   * 这里按「名字 + 起止」认一下：已经有就复用它，没有才真的追加一条阶段。
   * stage 为 null 表示先不归阶段 —— 直接放到「未归类」，不必先建阶段。
   */
  function addOne(text: string, stage: Stage | null) {
    if (!stage) {
      setGoals(list => addGoal(list, { stageId: UNSORTED_STAGE_ID, text }))
      setGoalOpen(false)
      return
    }

    const existing = stages.find(
      item =>
        item.title === stage.title && item.startKey === stage.startKey && item.endKey === stage.endKey,
    )
    if (existing) {
      setGoals(list => addGoal(list, { stageId: existing.id, text }))
    } else {
      // 面板给的 order 只是「排最后」的意思，真实值按现有最大值算
      const created: Stage = { ...stage, order: nextStageOrder(stages) }
      setStages(list => [...list, created])
      setGoals(list => addGoal(list, { stageId: created.id, text }))
    }
    setGoalOpen(false)
  }

  function addAchievementItem(title: string, criteria: string, stageId: number) {
    setAchievements(list => addAchievement(list, title, criteria, stageId))
    setAddingFor(null)
  }

  /** 删成就：任务不跟着删，只摘掉归属，它们退回普通任务 */
  function removeAchievementItem(id: number) {
    setAchievements(list => removeAchievement(list, id))
    setTodos(list => detachTasks(list, id))
  }

  /**
   * 删阶段：它下面的成就一起删（removeStage 已经把新数组算好了），
   * 这些成就的任务只摘掉归属 —— 任务本身留在计划·任务里，
   * 不然会变成一批谁也看不见的孤儿任务。
   */
  function removeStageItem(stage: Stage) {
    const result = removeStage(stages, achievements, stage.id)
    setStages(result.stages)
    setAchievements(result.achievements)
    if (result.removedAchievementIds.length > 0) {
      setTodos(list => detachTasks(list, result.removedAchievementIds))
    }
  }

  return (
    <>
      <div className="page page--fab">
        <h2 className="page__title">目标</h2>

        <section className="career career--edit" aria-label="职业目标">
          {CAREER_ROWS.map(row => {
            const value = career[row.key]
            const editing = careerField === row.key
            const days = row.key === 'targetDate' && value ? targetDays(career) : undefined
            const hint = days === undefined ? '' : countdownText(days)

            return (
              <div className="career__row" key={row.key}>
                <span className="career__key">{row.label}</span>

                {editing ? (
                  <span className="career__editline">
                    <input
                      className={
                        row.type === 'date'
                          ? 'input input--date career__input'
                          : 'input career__input'
                      }
                      type={row.type}
                      value={careerDraft}
                      onChange={event => setCareerDraft(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') commitCareer()
                        if (event.key === 'Escape') setCareerField(null)
                      }}
                      aria-label={row.label}
                      placeholder={row.placeholder}
                      maxLength={row.type === 'date' ? undefined : 120}
                      autoFocus
                    />
                    <button type="button" className="btn btn--primary final__save" onClick={commitCareer}>
                      保存
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="career__valbtn"
                    onClick={() => startEditCareer(row.key)}
                  >
                    {value ? (
                      <span className="career__val">{value}</span>
                    ) : (
                      <span className="career__val career__val--empty">{row.placeholder}</span>
                    )}
                    {hint && <span className="career__hint">{hint}</span>}
                  </button>
                )}
              </div>
            )
          })}
        </section>

        <GoalList
          goals={sortedGoals}
          stages={stages}
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

        <h3 className="goal-section">阶段</h3>

        <StageList
          stages={stages}
          achievements={achievements}
          todos={todos}
          onAddStage={() => setStageOpen(true)}
          onEditStage={stage => setEditingStage(stage)}
          onRemoveStage={removeStageItem}
          onToggleTask={id => setTodos(list => toggleTodo(list, id))}
          onRemoveTask={id => setTodos(list => removeTodo(list, id))}
          onAddTask={(achievementId, text, dueDate) =>
            setTodos(list => addAchievementTodo(list, text, achievementId, dueDate))
          }
          onEditTask={(id, text, dueDate) => setTodos(list => updateTodo(list, id, { text, dueDate }))}
          onUpdateAchievement={(id, patch) =>
            setAchievements(list => updateAchievement(list, id, patch))
          }
          onCompleteAchievement={id => setAchievements(list => markAchievementDone(list, id))}
          onReopenAchievement={id => setAchievements(list => reopenAchievement(list, id))}
          onRemoveAchievement={removeAchievementItem}
          onAddAchievement={stageId => setAddingFor({ stageId })}
        />
      </div>

      <button
        type="button"
        className="fab"
        onClick={() => setAddingFor({ stageId: currentStage(stages)?.id ?? UNSORTED_STAGE_ID })}
        aria-label="添加成就"
        aria-haspopup="dialog"
        aria-expanded={addingFor !== null}
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
        <GoalAddPanel stages={stages} onClose={() => setGoalOpen(false)} onSubmit={addOne} />
      )}

      {/* key 让「从 A 阶段加」切到「从 B 阶段加」时重新挂载，预选才会跟着变 */}
      {addingFor && (
        <AchievementForm
          key={addingFor.stageId}
          stages={stages}
          defaultStageId={addingFor.stageId}
          onClose={() => setAddingFor(null)}
          onAdd={addAchievementItem}
        />
      )}

      {stageOpen && (
        <StageForm
          onClose={() => setStageOpen(false)}
          onSubmit={input => {
            setStages(list => addStage(list, input))
            setStageOpen(false)
          }}
        />
      )}

      {editingStage && (
        <StageForm
          stage={editingStage}
          onClose={() => setEditingStage(null)}
          onSubmit={input => {
            setStages(list => updateStage(list, editingStage.id, input))
            setEditingStage(null)
          }}
        />
      )}
    </>
  )
}
