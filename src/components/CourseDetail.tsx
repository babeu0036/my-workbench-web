import { useState } from 'react'
import ConfirmDelete from './ConfirmDelete'
import CourseFields, { courseToFields, fieldsToDraft } from './CourseFields'
import type { CourseFieldsValue } from './CourseFields'
import { inactiveReason, isCourseChanged } from '../lib/courses'
import type { Course, Subject } from '../lib/types'

type Props = {
  course: Course
  /** 页面上看的是第几周（可能是翻出来的），「上不上」按这个算 */
  weekNo: number | null
  /** 看的是不是今天这周，只影响「这周不上」这句的措辞 */
  isCurrentWeek: boolean
  subjects: Subject[]
  onClose: () => void
  /** 保存：把整份字段交给页面，改名/同步的判断在数据层，这里不做 */
  onSave: (draft: Omit<Course, 'id'>) => void
  onRemove: () => void
}

/**
 * 点课程弹出的编辑面板。
 *
 * 原来只是只读的详情，现在每个字段都能改，所以页面上要交代清楚
 * 「哪些改动会连累同名课程」—— 否则用户改完一个名字，发现另外两条也变了
 * 会以为是 bug。删除仍是唯一破坏性操作，走 ConfirmDelete 的两步确认。
 */
export default function CourseDetail({
  course,
  weekNo,
  isCurrentWeek,
  subjects,
  onClose,
  onSave,
  onRemove,
}: Props) {
  const [value, setValue] = useState<CourseFieldsValue>(() => courseToFields(course))
  const [error, setError] = useState('')

  const reason = inactiveReason(course, weekNo)
  // 翻到别的周时不能再说「这周」—— 说的明明是第 12 周
  const when = isCurrentWeek ? '这周' : `第 ${weekNo} 周`

  const draft = fieldsToDraft(value)
  // 校验不过时也算「改过」：不然清空课程名之后保存按钮直接变灰，
  // 用户得不到一句解释。点了保存再在下面报「先写课程名」。
  const changed = typeof draft === 'string' ? true : isCourseChanged(course, draft)

  function update(patch: Partial<CourseFieldsValue>) {
    setValue(prev => ({ ...prev, ...patch }))
    setError('')
  }

  function save() {
    const next = fieldsToDraft(value)
    if (typeof next === 'string') {
      setError(next)
      return
    }
    onSave(next)
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="编辑课程">
        <div className="sheet__head">
          <span className="sheet__title">编辑课程</span>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="收起">
            ×
          </button>
        </div>

        {reason && (
          <p className="detail__off">
            {reason}，{when}不上
          </p>
        )}

        <CourseFields value={value} onChange={update} subjects={subjects} />

        <p className="sheet__hint">
          课程名、地点、科目会一起改到同名的其他课；周几、节次、周次只改这一条。
        </p>

        {error && <p className="form__error">{error}</p>}

        <div className="sheet__actions">
          <ConfirmDelete label="删除这门课" onConfirm={onRemove} />
          <button
            type="button"
            className="btn btn--primary sheet__save"
            onClick={save}
            disabled={!changed}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
