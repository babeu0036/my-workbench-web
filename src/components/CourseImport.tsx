import { useState } from 'react'
import { hasSameCourse, parseCourseText } from '../lib/courses'
import type { ParseError } from '../lib/courses'
import type { Course } from '../lib/types'

type Props = {
  /** 现有的课，用来跳过重复导入 */
  existing: Course[]
  onClose: () => void
  onImport: (drafts: Omit<Course, 'id'>[]) => void
}

const PLACEHOLDER = `一行一门课，顺序随便 —— 按内容认

高数 周一 1-2 1-16 3-201
机房 C语言 1-16单 周二 3-4
英语 周三 5-6 1-16双 A-101
大学物理 周四 7-8 2-16双 实验楼

没写周次按 1-16 每周；地点可以不写`

/**
 * 粘贴导入。
 *
 * 一行按空格 / Tab 切开，逐段按内容认（周几、节次、周次、地点、课名），
 * 顺序随便写。点「导入」之后：解析成功的立刻进课表，失败的和重复的留在
 * 文本框里，逐行说清楚为什么没进去。这样改完能再点一次，也不会把已经
 * 成功的那些重复导一遍。一行问题都没有就自动收起面板。
 */
export default function CourseImport({ existing, onClose, onImport }: Props) {
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<ParseError[]>([])
  const [done, setDone] = useState(0)

  function run() {
    const result = parseCourseText(text)
    const lines = text.split(/\r?\n/)
    const failed = new Set(result.errors.map(item => item.line))

    // 解析成功的行（按行号升序），和 result.courses 一一对应
    const okLines = lines
      .map((raw, index) => ({ no: index + 1, text: raw.trim() }))
      .filter(item => item.text !== '' && !failed.has(item.no))

    const fresh: Omit<Course, 'id'>[] = []
    // 查重要连本次刚导进去的一起算，否则同一份文本里两行相同会都进去
    const known: Course[] = [...existing]
    const problems: ParseError[] = [...result.errors]
    const kept: { no: number; text: string }[] = []

    // 解析失败的行原样留在框里
    result.errors.forEach(item => {
      const raw = lines[item.line - 1]?.trim()
      if (raw) kept.push({ no: item.line, text: raw })
    })

    result.courses.forEach((draft, index) => {
      const source = okLines[index]
      if (hasSameCourse(known, draft)) {
        problems.push({
          line: source.no,
          message: `第 ${source.no} 行和已有的课重复（名称、周几、节次、周次都一样），没有导入`,
        })
        kept.push({ no: source.no, text: source.text })
        return
      }
      fresh.push(draft)
      known.push({ ...draft, id: -1 })
    })

    problems.sort((a, b) => a.line - b.line)
    kept.sort((a, b) => a.no - b.no)

    setErrors(problems)
    setDone(fresh.length)
    if (fresh.length > 0) onImport(fresh)
    setText(kept.map(item => item.text).join('\n'))

    if (problems.length === 0) onClose()
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-mask" onClick={onClose} aria-hidden="true" />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="导入课程">
        <div className="sheet__head">
          <span className="sheet__title">导入课程</span>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="收起">
            ×
          </button>
        </div>

        <textarea
          className="input input--area"
          value={text}
          onChange={e => {
            setText(e.target.value)
            setErrors([])
            setDone(0)
          }}
          placeholder={PLACEHOLDER}
          rows={7}
          aria-label="课程文本"
        />

        <p className="sheet__hint">
          列之间空格或 Tab 都行，顺序不用管：认得出周几、节次、周次、地点和课名就行。
          周次可写 1-16 / 1-16单 / 1-16双 / 单周 / 双周；没写周次按 1-16 每周，
          没写节次按第 1-2 节，地点可以省略。
        </p>

        {done > 0 && <p className="import__ok">已导入 {done} 门</p>}

        {errors.length > 0 && (
          <ul className="import__errors">
            {errors.map(item => (
              <li key={item.line}>{item.message}</li>
            ))}
          </ul>
        )}

        <button type="button" className="btn btn--primary sheet__submit" onClick={run}>
          导入
        </button>
      </div>
    </div>
  )
}
