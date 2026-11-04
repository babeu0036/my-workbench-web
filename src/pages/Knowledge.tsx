import ComingSoonPage from '../components/ComingSoonPage'

/**
 * 知识库。全新的一级项，还没做内容 —— 先给空状态和入口，
 * 免得侧边栏里点进来是一片空白，像是页面没加载出来。
 */
export default function Knowledge() {
  return (
    <ComingSoonPage
      title="知识库"
      note="还没有记录，点右下角添加"
      toast="知识库还没做，下一版补上"
    />
  )
}
