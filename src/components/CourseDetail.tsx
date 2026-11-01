import ConfirmDelete from './ConfirmDelete'
import { inactiveReason, periodLabel, weekdayName, weeksText } from '../lib/courses'
import type { Course, Subject } from '../lib/types'

type Props = {
  course: Course
  /** 页面上看的是第几周（可能是翻出来的），「上不上」按这个算 */
  weekNo: number | null
  /** 看的是不是今天这周，只影响「这周不上」这句的措辞 */
  isCurrentWeek: boolean
  subjects: Subject[]
  onClose: () => void
  onRemove: () => void
}

/** 点课程弹出的详情。只有删除是破坏性操作，所以复用 ConfirmDelete 的两步确认 */
export default function CourseDetail({
  course,
  weekNo,
  isCurrentWeek,
  subjects,
  onClose,
  onRemove,
}: Props) {
  const reason = inactiveReason(course, weekNo)
  const subject = subjects.find(item => item.id === course.subjectId)
  // 翻到别的周时不能再说「这周」—— 说的明明是第 12 周
  const when = isCurrentWeek ? '这周' : `第 ${weekNo} 周`

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="课程详情">
        <div className="sheet__head">
          <span className="sheet__title">{course.name}</span>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="收起">
            ×
          </button>
        </div>

        <dl className="detail">
          <div className="detail__row">
            <dt>时间</dt>
            <dd>
              {weekdayName(course.weekday)} {periodLabel(course.startPeriod, course.endPeriod)}
            </dd>
          </div>
          <div className="detail__row">
            <dt>周次</dt>
            <dd>{weeksText(course)}</dd>
          </div>
          {course.location && (
            <div className="detail__row">
              <dt>地点</dt>
              <dd>{course.location}</dd>
            </div>
          )}
          {subject && (
            <div className="detail__row">
              <dt>科目</dt>
              <dd>{subject.name}</dd>
            </div>
          )}
        </dl>

        {reason && (
          <p className="detail__off">
            {reason}，{when}不上
          </p>
        )}

        <div className="detail__actions">
          <ConfirmDelete label="删除这门课" onConfirm={onRemove} />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
