import type { Subject, SubjectSegment } from '../lib/types'

type Props = {
  subject: Subject | undefined
  seg: SubjectSegment
}

/**
 * 科目详情。英语 / 高数 / C语言 共用这一个组件，靠 id 区分。
 * 第一步是空壳，第 2 步接任务，第 6 步接错题。
 */
export default function SubjectPage({ subject, seg }: Props) {
  if (!subject) {
    return (
      <div className="page">
        <h2 className="page__title">科目</h2>
        <p className="page__hint">这个科目不存在，可能数据被改过。</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="page__title">{subject.name}</h2>
      <p className="page__hint">
        当前在「{seg === 'tasks' ? '任务' : '错题'}」这一段
      </p>
      <div className="empty-block">
        <p className="empty">这一页还没做</p>
        <p className="meta">任务在第 2 步接进来，错题在第 6 步</p>
      </div>
    </div>
  )
}
