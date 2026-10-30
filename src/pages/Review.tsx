import type { ReviewBlock } from '../lib/types'

type Props = {
  block: ReviewBlock
}

/**
 * 复盘。一页两块（数据 / 目标），侧边栏的两个二级项指的是同一页的两块。
 * 第 5 步接真实数据与目标结算。
 */
export default function Review({ block }: Props) {
  return (
    <div className="page">
      <h2 className="page__title">复盘</h2>
      <p className="page__hint">当前在「{block === 'data' ? '数据' : '目标'}」这一块</p>

      <div className="empty-block">
        <p className="empty">这一页还没做</p>
        <p className="meta">本周完成率和目标结算在第 5 步接进来</p>
      </div>
    </div>
  )
}
