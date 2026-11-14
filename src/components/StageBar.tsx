import { weeksUntil } from '../lib/date'
import type { Stage } from '../lib/types'

type Props = {
  /** 今天落在里面、结束最近的那个阶段 */
  stage?: Stage
  /** 这个阶段是第几个（按页面上的先后，从 1 开始）。没有阶段时是 0 */
  index: number
}

/**
 * 首页职业目标卡下面那条细的阶段条：第 1 阶段 · 大一上 · 还剩 11 周。
 *
 * 只读一行，不放按钮 —— 想改阶段去目标页。没有进行中的阶段时也留一条灰的，
 * 免得下面几块内容突然往上跳一格。
 */
export default function StageBar({ stage, index }: Props) {
  if (!stage) {
    return (
      <p className="stagebar stagebar--empty">
        <span>还没有进行中的阶段</span>
      </p>
    )
  }

  const weeks = weeksUntil(stage.endKey)

  return (
    <p className="stagebar" aria-label={`当前阶段：${stage.title}`}>
      <span className="stagebar__no">第 {index} 阶段</span>
      <span className="stagebar__dot" aria-hidden="true">
        ·
      </span>
      <span className="stagebar__title">{stage.title}</span>
      <span className="stagebar__dot" aria-hidden="true">
        ·
      </span>
      <span className="stagebar__left">{weeks > 0 ? `还剩 ${weeks} 周` : '已经结束'}</span>
    </p>
  )
}
