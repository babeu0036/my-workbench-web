import type { Course } from '../lib/types'

type Props = {
  /** 今天上的课，页面里已经按起始节排好序 */
  items: Course[]
}

/** 第1-2节 / 第5节。这里是当句子读的，所以不带空格 */
function periodText(start: number, end: number): string {
  return start === end ? `第${start}节` : `第${start}-${end}节`
}

/**
 * 今天有课。
 *
 * 当天没课就整块不渲染（返回 null），不留一张「今天没课」的空卡 ——
 * 周末打开首页时不该被一块空卡片占掉一屏。
 */
export default function TodayCourses({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section className="card today-class" aria-label="今天有课">
      <div className="card__head">
        <span className="card__title">今天有课</span>
        <span className="card__note">{items.length} 门</span>
      </div>

      <ul className="today-class__list">
        {items.map(course => (
          <li key={course.id} className="today-class__row">
            <span className="today-class__period">
              {periodText(course.startPeriod, course.endPeriod)}
            </span>
            <span className="today-class__name">{course.name}</span>
            {course.location && <span className="today-class__place">{course.location}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
