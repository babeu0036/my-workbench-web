import { daysUntil } from './date'
import { isDateKey } from './stages'
import type { Career } from './types'

/**
 * 职业目标：一句话愿景 + 角色 + 目标日期。
 *
 * 存在 `workbench.career`，第一次打开时由 storage.ts 的 migrateCareer 从
 * 老的 `workbench.vision` / `workbench.finalGoal` 抄过来（老键保留不删）。
 * 三样都可以空着 —— 空着就显示灰字提示，不去编默认值。
 */

export const EMPTY_CAREER: Career = { vision: '', role: '', targetDate: '' }

/** 读盘兜底：缺字段、类型不对都退回空字符串，不让首页因为一条坏数据崩掉 */
export function normalizeCareer(raw: unknown): Career {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_CAREER }
  const item = raw as Partial<Career>
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

  return {
    vision: text(item.vision),
    role: text(item.role),
    targetDate: isDateKey(item.targetDate) ? item.targetDate : '',
  }
}

/** 距目标日期还有几天。没设日期、日期解析不出来时返回 undefined */
export function targetDays(career: Career, now: number = Date.now()): number | undefined {
  if (!career.targetDate) return undefined
  const days = daysUntil(career.targetDate, now)
  return Number.isNaN(days) ? undefined : days
}

/** 天数写成人话：还有 231 天 / 就是今天 / 已经过了 5 天 */
export function countdownText(days: number): string {
  if (days > 0) return `还有 ${days} 天`
  if (days === 0) return '就是今天'
  return `已经过了 ${-days} 天`
}
