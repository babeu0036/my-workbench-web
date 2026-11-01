import { MAX_PERIOD, WEEKDAY_OPTIONS, isActiveInWeek, sortCourses } from '../lib/courses'
import type { Course } from '../lib/types'

type Props = {
  courses: Course[]
  /** null = 还没设学期开始，这时所有课都按「上」显示 */
  weekNo: number | null
  /** 今天周几，1-7 */
  today: number
  onSelect: (course: Course) => void
}

/**
 * 宽屏的课程表：左边一列节次，右边 7 列。
 *
 * 定位用 CSS Grid 的 grid-row / grid-column，不用 table 的 rowSpan ——
 * 跨几节就跨几行，改课程时长不用动渲染逻辑。
 * 同一格有好几门课时（比如单周课和双周课撞在一起），整组塞进一个
 * 容器里竖着排，不会互相盖住。
 */
export default function CourseGrid({ courses, weekNo, today, onSelect }: Props) {
  // 同一时间段的多门课归到一组：key 用「周几-起始节-结束节」
  const slots = new Map<string, Course[]>()
  sortCourses(courses).forEach(course => {
    const key = `${course.weekday}-${course.startPeriod}-${course.endPeriod}`
    const list = slots.get(key)
    if (list) list.push(course)
    else slots.set(key, [course])
  })

  return (
    <div className="grid-wrap">
      <div className="grid" role="table" aria-label="本周课程表">
        <div className="grid__corner" role="columnheader" aria-label="节次" />

        {WEEKDAY_OPTIONS.map(day => (
          <div
            key={day.value}
            role="columnheader"
            className={day.value === today ? 'grid__head grid__head--today' : 'grid__head'}
            aria-label={day.label}
          >
            {day.label.replace('周', '')}
          </div>
        ))}

        {/* 今天整列铺一层底色，压在课程块下面 */}
        <div
          className="grid__today"
          style={{ gridColumn: today + 1, gridRow: `2 / span ${MAX_PERIOD}` }}
          aria-hidden="true"
        />

        {Array.from({ length: MAX_PERIOD }, (_, i) => i + 1).map(period => (
          <div
            key={period}
            role="rowheader"
            className="grid__period"
            style={{ gridRow: period + 1, gridColumn: 1 }}
          >
            {period}
          </div>
        ))}

        {Array.from(slots.entries()).map(([key, list]) => {
          const first = list[0]
          return (
            <div
              key={key}
              className="grid__slot"
              style={{
                gridColumn: first.weekday + 1,
                gridRow: `${first.startPeriod + 1} / ${first.endPeriod + 2}`,
              }}
            >
              {list.map(course => {
                const active = isActiveInWeek(course, weekNo)
                return (
                  <button
                    key={course.id}
                    type="button"
                    className={active ? 'course' : 'course course--off'}
                    onClick={() => onSelect(course)}
                    title={course.location ? `${course.name} · ${course.location}` : course.name}
                  >
                    <span className="course__name">{course.name}</span>
                    {course.location && <span className="course__loc">{course.location}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
