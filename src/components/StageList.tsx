import { useEffect, useRef, useState } from 'react'
import AchievementCard from './AchievementCard'
import ConfirmDelete from './ConfirmDelete'
import { tasksOf } from '../lib/milestones'
import {
  UNSORTED_STAGE_ID,
  UNSORTED_STAGE_TITLE,
  achievementsOf,
  currentStage,
  orphanAchievements,
  sortStages,
  stageRangeText,
  stageStats,
} from '../lib/stages'
import type { Achievement, Stage, Todo } from '../lib/types'

type Props = {
  stages: Stage[]
  achievements: Achievement[]
  /** 全部任务，卡片自己按 achievementId 分 */
  todos: Todo[]
  onAddStage: () => void
  onEditStage: (stage: Stage) => void
  onRemoveStage: (stage: Stage) => void
  onToggleTask: (id: number) => void
  onRemoveTask: (id: number) => void
  onAddTask: (achievementId: number, text: string, dueDate: string) => void
  onEditTask: (id: number, text: string, dueDate: string) => void
  onRemoveAchievement: (id: number) => void
  /** 改短名 / 判断标准 / 面试能说 / 证据 */
  onUpdateAchievement: (
    id: number,
    patch: { short?: string; criteria?: string; why?: string; evidence?: string },
  ) => void
  /** 写了证据才能确认完成 */
  onCompleteAchievement: (id: number) => void
  onReopenAchievement: (id: number) => void
  /** 点某个阶段里的「添加里程碑」，面板打开时预选这个阶段 */
  onAddAchievement: (stageId: number) => void
}

/**
 * 阶段列表 + 每个阶段下面的里程碑卡。
 *
 * 当前阶段（今天落在起止之间那个）默认展开，其余折叠 —— 一屏里同时摊开
 * 四个阶段的所有任务，翻起来比折叠更累。手动折叠/展开的结果记在这次会话里，
 * 刷新后回到按日期算的默认值。
 *
 * 「添加里程碑」在每张阶段卡里（展开后最下面那颗），页面不再有全局的
 * 悬浮按钮 —— 加的东西总得落在某个阶段下，入口贴着阶段走更直接。
 *
 * 没有阶段字段的老里程碑放进最后那个「未归类」组，可以之后一条条归过去；
 * 这个组不是真阶段，所以没有编辑和删除。
 */
export default function StageList({
  stages,
  achievements,
  todos,
  onAddStage,
  onEditStage,
  onRemoveStage,
  onToggleTask,
  onRemoveTask,
  onAddTask,
  onEditTask,
  onRemoveAchievement,
  onUpdateAchievement,
  onCompleteAchievement,
  onReopenAchievement,
  onAddAchievement,
}: Props) {
  const sorted = sortStages(stages)
  const orphans = orphanAchievements(achievements, stages)

  // 0 是「未归类」组的 key（真阶段的 id 由时间戳生成，不可能是 0）
  const [open, setOpen] = useState<Set<number>>(() => {
    const active = currentStage(stages)
    return new Set(active ? [active.id] : [])
  })

  // 新加的阶段自动展开，删掉的从展开集合里清掉；「未归类」不参与自动展开
  const knownRef = useRef<number[]>(stages.map(stage => stage.id))
  useEffect(() => {
    const prev = knownRef.current
    const ids = stages.map(stage => stage.id)
    const added = ids.filter(id => !prev.includes(id))
    const removed = prev.filter(id => !ids.includes(id))
    knownRef.current = ids
    if (added.length === 0 && removed.length === 0) return

    setOpen(current => {
      const next = new Set([...current].filter(id => !removed.includes(id)))
      added.forEach(id => next.add(id))
      return next
    })
  }, [stages])

  function toggle(id: number) {
    setOpen(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** 一组里程碑卡：任务、勾选、编辑、删除都从页面透传下来 */
  function cards(list: Achievement[]) {
    return list.map(item => (
      <AchievementCard
        key={item.id}
        achievement={item}
        tasks={tasksOf(todos, item.id)}
        onToggleTask={onToggleTask}
        onRemoveTask={onRemoveTask}
        onAddTask={(text, dueDate) => onAddTask(item.id, text, dueDate)}
        onEditTask={onEditTask}
        onUpdate={patch => onUpdateAchievement(item.id, patch)}
        onComplete={() => onCompleteAchievement(item.id)}
        onReopen={() => onReopenAchievement(item.id)}
        onRemove={() => onRemoveAchievement(item.id)}
      />
    ))
  }

  /**
   * 「未归类」那一组：没有 stageId、或者挂的阶段已经被删掉的里程碑都落在这儿。
   * 它不是真阶段，所以没有编辑和删除，也没有折叠记忆的意义 —— 只是在列表末尾兜住。
   *
   * 阶段被全删光时也要画出来（forceOpen）：不然那些任务和里程碑还在，
   * 页面上却一个入口都没有，只能去 localStorage 里捞。
   */
  function orphanBlock(forceOpen = false) {
    if (orphans.length === 0) return null

    const done = orphans.filter(item => item.doneAt !== undefined).length
    const isOpen = forceOpen || open.has(UNSORTED_STAGE_ID)
    return (
      <section className={isOpen ? 'stage stage--orphan stage--open' : 'stage stage--orphan'}>
        <div className="stage__head">
          <button
            type="button"
            className="stage__toggle"
            onClick={() => toggle(UNSORTED_STAGE_ID)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? '收起' : '展开'}：${UNSORTED_STAGE_TITLE}`}
          >
            <span className="stage__arrow" aria-hidden="true">
              ▸
            </span>
            <span className="stage__title">{UNSORTED_STAGE_TITLE}</span>
            <span className="stage__range">没归到阶段的里程碑</span>
            <span className="stage__count">
              {done}/{orphans.length}
            </span>
          </button>
        </div>

        {isOpen && <div className="stage__body">{cards(orphans)}</div>}
      </section>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="stage-list">
        <button type="button" className="stage-empty" onClick={onAddStage}>
          还没有阶段，点这里新建
        </button>
        {orphanBlock(true)}
      </div>
    )
  }

  return (
    <div className="stage-list">
      {sorted.map(stage => {
        const list = achievementsOf(achievements, stage.id)
        const stats = stageStats(achievements, stage.id)
        const isOpen = open.has(stage.id)

        return (
          <section key={stage.id} className={isOpen ? 'stage stage--open' : 'stage'}>
            <div className="stage__head">
              <button
                type="button"
                className="stage__toggle"
                onClick={() => toggle(stage.id)}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? '收起' : '展开'}阶段：${stage.title}`}
              >
                <span className="stage__arrow" aria-hidden="true">
                  ▸
                </span>
                <span className="stage__title">{stage.title}</span>
                <span className="stage__range">{stageRangeText(stage)}</span>
                <span className="stage__count">
                  {stats.done}/{stats.total}
                </span>
              </button>

              <span className="stage__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onEditStage(stage)}
                  aria-label={`编辑阶段：${stage.title}`}
                >
                  编辑
                </button>
                <ConfirmDelete
                  label="删除"
                  hint={
                    list.length === 0
                      ? '这个阶段下没有里程碑'
                      : `该阶段下有 ${list.length} 个里程碑，将一并删除`
                  }
                  onConfirm={() => onRemoveStage(stage)}
                />
              </span>
            </div>

            {isOpen && (
              <div className="stage__body">
                {list.length === 0 ? (
                  <button
                    type="button"
                    className="stage__empty"
                    onClick={() => onAddAchievement(stage.id)}
                  >
                    这个阶段还没有里程碑，点这里加一条
                  </button>
                ) : (
                  <>
                    {cards(list)}
                    <button
                      type="button"
                      className="stage__more"
                      onClick={() => onAddAchievement(stage.id)}
                    >
                      + 添加里程碑
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        )
      })}

      {orphanBlock()}

      <button type="button" className="stage-add" onClick={onAddStage}>
        + 新建阶段
      </button>
    </div>
  )
}
