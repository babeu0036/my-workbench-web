import { MAX_PERIOD, WEEKDAY_OPTIONS, isActiveInWeek, sortCourses } from '../lib/courses'
import type { Course } from '../lib/types'

type Props = {
  courses: Course[]
  /** null = 还没设学期开始，这时所有课都按「上」显示 */
  weekNo: number | null
  /** 今天周几，1-7；null = 看的不是本周，不收今天的高亮 */
  today: number | null
  onSelect: (course: Course) => void
  /** 点空格子：带着那一格的位置去开门表单 */
  onCreate: (weekday: number, period: number) => void
}

/**
 * 宽屏的课程表：左边一列节次，右边 7 列。
 *
 * 定位用 CSS Grid 的 grid-row / grid-column，不用 table 的 rowSpan ——
 * 跨几节就跨几行，改课程时长不用动渲染逻辑。
 * 同一格有好几门课时（比如单周课和双周课撞在一起），整组塞进一个
 * 容器里竖着排，不会互相盖住。
 *
 * 每个格子底下都铺了一个透明的「空位」按钮：有课的地方被课程块盖住
 * （课程块 z-index 更高），没课的地方点一下就按那一格加课。
 *
 * today 传 null 表示「现在看的不是本周」（翻周了），这时不收今天的高亮 ——
 * 第 12 周的表里亮着今天那一列，等于告诉人今天是第 12 周的哪天。
 */
export default function CourseGrid({ courses, weekNo, today, onSelect, onCreate }: Props) {
  // 同一时间段的多门课归到一组：key 用「周几-起始节-结束节」
  const slots = new Map<string, Course[]>()
  sortCourses(courses).forEach(course => {
    const key = `${course.weekday}-${course.startPeriod}-${course.endPeriod}`
    const list = slots.get(key)
    if (list) list.push(course)
    else slots.set(key, [course])
  })

  // 被课占住的格子不放空位按钮：一是点不到（课程块在上面），
  // 二是课程块底色是半透明的，底下的 + 会透出来，看着像块里长了个加号
  const taken = new Set<string>()
  slots.forEach(list => {
    const { weekday, startPeriod, endPeriod } = list[0]
    for (let period = startPeriod; period <= endPeriod; period += 1) {
      taken.add(`${weekday}-${period}`)
    }
  })

  return (
    <div className="grid-wrap">
      <div className="grid" role="table" aria-label={weekNo === null ? '课程表' : `第 ${weekNo} 周课程表`}>
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

        {/* 今天整列铺一层底色，压在课程块下面；翻周时没有「今天」可铺 */}
        {today !== null && (
          <div
            className="grid__today"
            style={{ gridColumn: today + 1, gridRow: `2 / span ${MAX_PERIOD}` }}
            aria-hidden="true"
          />
        )}

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

        {/* 空位层：每格一个透明按钮，有课的地方不铺（铺了也被课程块盖住）。
            不进 Tab 顺序 —— 84 个格子会把键盘导航拖垮，加课还有右下角 + 和导入两条路。 */}
        {Array.from({ length: MAX_PERIOD }, (_, i) => i + 1).flatMap(period =>
          WEEKDAY_OPTIONS.filter(day => !taken.has(`${day.value}-${period}`)).map(day => (
            <button
              key={`${day.value}-${period}`}
              type="button"
              className="grid__cell"
              style={{ gridColumn: day.value + 1, gridRow: period + 1 }}
              onClick={() => onCreate(day.value, period)}
              aria-label={`在${day.label}第 ${period} 节加课`}
              tabIndex={-1}
            >
              <span className="grid__cell-plus" aria-hidden="true">
                +
              </span>
            </button>
          )),
        )}

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
