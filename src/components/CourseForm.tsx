import { useEffect, useRef, useState } from 'react'
import CourseFields, { blankFields, fieldsToDraft } from './CourseFields'
import type { CourseFieldsValue } from './CourseFields'
import type { Course, Subject } from '../lib/types'

type Props = {
  subjects: Subject[]
  /** 今天周几，1-7。新建时默认落在今天 */
  today: number
  /**
   * 从网格的空格子点进来时带的预填值：周几和那一节。
   * 没带（右下角 + 打开）就落在今天、第 1-2 节。
   */
  seed?: { weekday: number; startPeriod: number }
  onClose: () => void
  onAdd: (draft: Omit<Course, 'id'>) => void
}

/**
 * 添加课程的面板。
 * 字段和校验全在 CourseFields 里，和编辑弹窗共用一份；
 * 这里只负责「新建」这一个身份：初始化空白值、提交后交给页面的 addDrafts。
 */
export default function CourseForm({ subjects, today, seed, onClose, onAdd }: Props) {
  const [value, setValue] = useState<CourseFieldsValue>(() =>
    blankFields(seed?.weekday ?? today, seed?.startPeriod),
  )
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => nameRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function update(patch: Partial<CourseFieldsValue>) {
    setValue(prev => ({ ...prev, ...patch }))
    setError('')
  }

  function submit() {
    const draft = fieldsToDraft(value)
    if (typeof draft === 'string') {
      setError(draft)
      return
    }
    onAdd(draft)
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="添加课程">
        <div className="sheet__head">
          <span className="sheet__title">添加课程</span>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="收起">
            ×
          </button>
        </div>

        <CourseFields value={value} onChange={update} subjects={subjects} nameRef={nameRef} />

        {error && <p className="form__error">{error}</p>}

        <button type="button" className="btn btn--primary sheet__submit" onClick={submit}>
          添加课程
        </button>
      </div>
    </div>
  )
}
