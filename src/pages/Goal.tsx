import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import AchievementForm from '../components/AchievementForm'
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
import { addStage, removeStage, updateStage } from '../lib/stages'
import { addAchievementTodo, removeTodo, toggleTodo, updateTodo } from '../lib/todos'
import type { Achievement, Career, Stage, Todo } from '../lib/types'

type CareerField = 'vision' | 'role' | 'targetDate'

const CAREER_ROWS: { key: CareerField; label: string; placeholder: string; type: 'text' | 'date' }[] =
  [
    { key: 'vision', label: '愿景', placeholder: '想成为什么样的人、做成什么事', type: 'text' },
    { key: 'role', label: '角色', placeholder: '想去的位置，比如「嵌入式开发工程师」', type: 'text' },
    { key: 'targetDate', label: '目标日期', placeholder: '还没定', type: 'date' },
  ]

type Props = {
  /** 全部任务。这个页面是唯一看得见里程碑任务的地方 */
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  achievements: Achievement[]
  setAchievements: Dispatch<SetStateAction<Achievement[]>>
  /** 职业目标：愿景 / 角色 / 目标日期。首页那张卡读的是同一份 */
  career: Career
  setCareer: Dispatch<SetStateAction<Career>>
  /** 阶段：目标页唯一的时间轴，里程碑都挂在它下面 */
  stages: Stage[]
  setStages: Dispatch<SetStateAction<Stage[]>>
}

/**
 * 目标。从上到下只有两段：职业目标（三行）→ 阶段列表（每个阶段里是里程碑卡）。
 *
 * 以前中间还有一列扁平的「目标条目」，跟里程碑是两套并行的东西；
 * 现在目标条目已经并进里程碑（见 storage.ts 的迁移），页面上不再有第二个清单。
 * 添加里程碑的入口在每张阶段卡里，所以右下角那个悬浮 + 也去掉了。
 *
 * 职业目标就是首页顶部那张卡的数据源：愿景一句话、角色、目标日期。
 * 三行都是点一下就地改，改完回车或点保存，Esc 放弃。
 *
 * 里程碑按阶段折叠：当前阶段默认展开，其余收着。任务只在这一页出现
 * （见 withoutAchievement），所以这里拿到的是完整的 todos。
 */
export default function Goal({
  todos,
  setTodos,
  achievements,
  setAchievements,
  career,
  setCareer,
  stages,
  setStages,
}: Props) {
  // 打开添加里程碑的面板时记下预选的阶段；null = 关着
  const [addingFor, setAddingFor] = useState<{ stageId: number } | null>(null)
  const [stageOpen, setStageOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<Stage | null>(null)
  const [careerField, setCareerField] = useState<CareerField | null>(null)
  const [careerDraft, setCareerDraft] = useState('')

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

  function addAchievementItem(title: string, criteria: string, stageId: number) {
    setAchievements(list => addAchievement(list, title, criteria, stageId))
    setAddingFor(null)
  }

  /** 删里程碑：任务不跟着删，只摘掉归属，它们退回普通任务 */
  function removeAchievementItem(id: number) {
    setAchievements(list => removeAchievement(list, id))
    setTodos(list => detachTasks(list, id))
  }

  /**
   * 删阶段：它下面的里程碑一起删（removeStage 已经把新数组算好了），
   * 这些里程碑的任务只摘掉归属 —— 任务本身留在计划·任务里，
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
      <div className="page">
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
