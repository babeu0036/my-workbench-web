import ComingSoonPage from '../components/ComingSoonPage'

/**
 * 目标。这一版先把入口从「复盘 · 目标」挪到一级项，内容还没搬过来 ——
 * 原页面 `pages/ReviewGoal.tsx` 原样留着（跟科目页一样暂不提供入口），
 * 下一轮把本周目标卡和「写下周目标」接进来时直接用它。
 */
export default function Goal() {
  return (
    <ComingSoonPage
      title="目标"
      note="还没有目标，点右下角添加"
      toast="目标页还没接上，下一版补上"
    />
  )
}
