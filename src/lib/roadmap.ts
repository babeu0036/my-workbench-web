import { appendAchievements } from './achievements'
import { nextStageId, nextStageOrder, presetStages } from './stages'
import type { Achievement, AchievementDraft, Career, Stage } from './types'

/**
 * 「我的路线」：给刚打开工作台的人一条起跑线 ——
 * 四个学期阶段 + 第一阶段的三个里程碑 + 一份职业目标草稿。
 *
 * 两个入口共用这一份数据：
 * - 全新安装时由 storage.ts 的 seedFirstRoadmap 自动写一次（三个键都还空着才算全新）；
 * - 设置页那个「一键生成我的路线」按钮随时可以补。
 *
 * 生成是**合并**而不是覆盖：同名（或时间段完全一样）的阶段不加，同标题的里程碑不加，
 * 职业目标只填空着的那几行。手滑点两下不会变成两套路线，自己写过的东西也不会被抹掉。
 *
 * 纯函数，不碰 localStorage —— 写盘由调用方决定。
 */

/** 职业目标的默认值。只用来填空白字段，不覆盖用户已经写下的内容 */
export const PRESET_CAREER: Career = {
  vision: '成为能独立交付嵌入式产品的开发者',
  role: '嵌入式开发工程师',
  targetDate: '2029-06-30',
}

/**
 * 第一阶段的三个里程碑。判断标准写成「做到什么程度算成」——
 * 到时候能一眼核对，而不是一句「学会了」。
 *
 * 标题都偏长，所以顺手给个短名：任务行、比赛行右边那个小标签显示的是短名，
 * 让它自动截前四个字会变成「独立复刻…」「读完一份…」，看不出是哪件事。
 */
const PRESET_MILESTONES: { title: string; short: string; criteria: string }[] = [
  {
    title: '独立复刻小智AI',
    short: '小智AI',
    criteria: '不看现成教程，从零搭出一台能对话的语音助手，连续对话十轮不断线，代码和接线图都留档',
  },
  {
    title: '读完一份芯片数据手册并做笔记',
    short: '数据手册',
    criteria: '完整读完一份英文数据手册，整理出引脚、时序、寄存器三页笔记，能照着它写出初始化代码',
  },
  {
    title: '搭好开发环境并养成 Git 习惯',
    short: '开发环境',
    criteria: '工具链装好、能编译并烧录一个点灯程序；之后每次改动都进 Git，一周至少五个提交',
  },
]

export type RoadmapResult = {
  stages: Stage[]
  achievements: Achievement[]
  career: Career
  /** 这次真补了几条，设置页拿它拼提示。没变化时三个都是 0 */
  added: { stages: number; milestones: number; career: number }
}

/** 同名算同一个阶段；时间段完全一样也算（用户可能给它改过名字） */
function sameStage(
  stage: Stage,
  preset: { title: string; startKey: string; endKey: string },
): boolean {
  return (
    stage.title === preset.title ||
    (stage.startKey === preset.startKey && stage.endKey === preset.endKey)
  )
}

/**
 * 把预置路线并进现有数据。
 *
 * 三条里程碑挂在**第一个**预置阶段下（大一上）。那个阶段可能本来就在，
 * 所以用查出来的 id，不是新生成的 id —— 否则里程碑会挂到一条空阶段上。
 */
export function applyPresetRoadmap(
  current: { stages: Stage[]; achievements: Achievement[]; career: Career },
  now: number = Date.now(),
): RoadmapResult {
  const nextStages = [...current.stages]
  const stageIds: number[] = []
  let addedStages = 0

  presetStages(now).forEach(preset => {
    const hit = nextStages.find(stage => sameStage(stage, preset))
    if (hit) {
      stageIds.push(hit.id)
      return
    }
    const id = nextStageId(nextStages, now)
    nextStages.push({
      id,
      title: preset.title,
      startKey: preset.startKey,
      endKey: preset.endKey,
      order: nextStageOrder(nextStages),
    })
    stageIds.push(id)
    addedStages += 1
  })

  const firstStageId = stageIds[0]
  const drafts: AchievementDraft[] = PRESET_MILESTONES.filter(
    item => !current.achievements.some(exist => exist.title === item.title),
  ).map(item => ({
    title: item.title,
    short: item.short,
    criteria: item.criteria,
    why: '',
    kind: 'work',
    evidence: '',
    status: 'todo',
    ...(firstStageId === undefined ? {} : { stageId: firstStageId }),
  }))

  const achievements =
    drafts.length > 0 ? appendAchievements(current.achievements, drafts, now) : current.achievements

  // 只填空着的行：用户改过的愿景/角色/日期一个字都不动
  const career: Career = {
    vision: current.career.vision || PRESET_CAREER.vision,
    role: current.career.role || PRESET_CAREER.role,
    targetDate: current.career.targetDate || PRESET_CAREER.targetDate,
  }
  const addedCareer = (['vision', 'role', 'targetDate'] as const).filter(
    key => !current.career[key],
  ).length
  const careerChanged = addedCareer > 0

  return {
    stages: addedStages > 0 ? nextStages : current.stages,
    achievements,
    career: careerChanged ? career : current.career,
    added: { stages: addedStages, milestones: drafts.length, career: addedCareer },
  }
}
