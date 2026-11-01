import {
  WEEKDAY_OPTIONS,
  coursesOfDay,
  isActiveInWeek,
  periodLabel,
  weeksText,
} from '../lib/courses'
import type { Course } from '../lib/types'

type Props = {
  courses: Course[]
  weekNo: number | null
  today: number
  onSelect: (course: Course) => void
}

/**
 * 窄屏的课程表：周一到周日一段一段列下来，每天先写节次再写课。
 * 手机上 7 列 45px 根本放不下课名，所以这里换结构而不是硬挤。
 *
 * 非本周的课照样显示（只是变灰），不然单双周一切换课程就凭空消失，
 * 容易让人以为课丢了。
 */
export default function CourseDayList({ courses, weekNo, today, onSelect }: Props) {
  return (
    <div className="day-list">
      {WEEKDAY_OPTIONS.map(day => {
        const list = coursesOfDay(courses, day.value)
        const isToday = day.value === today

        return (
          <section
            key={day.value}
            className={isToday ? 'day-block day-block--today' : 'day-block'}
            aria-label={day.label}
          >
            <h3 className="day-block__title">
              {day.label}
              {isToday && <span className="day-block__tag">今天</span>}
            </h3>

            {list.length === 0 ? (
              <p className="day-block__empty">没课</p>
            ) : (
              list.map(course => {
                const active = isActiveInWeek(course, weekNo)
                return (
                  <button
                    key={course.id}
                    type="button"
                    className={active ? 'course-row' : 'course-row course-row--off'}
                    onClick={() => onSelect(course)}
                  >
                    <span className="course-row__period">
                      {periodLabel(course.startPeriod, course.endPeriod)}
                    </span>
                    <span className="course-row__body">
                      <span className="course-row__name">{course.name}</span>
                      <span className="course-row__meta">
                        {weeksText(course)}
                        {course.location && ` · ${course.location}`}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </section>
        )
      })}
    </div>
  )
}
