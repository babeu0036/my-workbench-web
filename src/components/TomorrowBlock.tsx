import { dayKey, dayKeyOffset, formatDateCn } from '../lib/date'
import type { Course, Todo } from '../lib/types'

type Props = {
  /** 明天上的课，页面里已经按起始节排好序 */
  courses: Course[]
  /** 明天到期的任务，已剔除做完的 */
  tasks: Todo[]
  /** 点任务行：明天的事今天不勾，跳去计划页处理 */
  onOpenPlan: () => void
}

/** 第1-2节 / 第5节。这里是当句子读的，所以不带空格 */
function periodText(start: number, end: number): string {
  return start === end ? `第${start}节` : `第${start}-${end}节`
}

/**
 * 首页的「明天」区块：明天有课 / 明天要到期的任务。
 *
 * 任务只展示、**不给勾**。明天的事今天勾掉，明天的完成环就少了分子，
 * 而且「明天还剩几件」也当场失真 —— 想处理就跳去计划页，那儿才是改动的地方。
 *
 * 有课有任务就分两段列，都没有就只剩一句话，不留两张空卡片。
 */
export default function TomorrowBlock({ courses, tasks, onOpenPlan }: Props) {
  const dateText = formatDateCn(dayKeyOffset(dayKey(), 1))
  const empty = courses.length === 0 && tasks.length === 0

  return (
    <section className="card tomorrow" aria-label="明天">
      <div className="card__head">
        <span className="tomorrow__title">明天 · {dateText}</span>
      </div>

      {empty && <p className="tomorrow__empty">明天没课也没任务，睡个好觉</p>}

      {courses.length > 0 && (
        <div className="tomorrow__block">
          <span className="tomorrow__label">有课</span>
          <ul className="today-class__list">
            {courses.map(course => (
              <li key={course.id} className="today-class__row">
                <span className="today-class__period">
                  {periodText(course.startPeriod, course.endPeriod)}
                </span>
                <span className="today-class__name">{course.name}</span>
                {course.location && <span className="today-class__place">{course.location}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="tomorrow__block">
          <span className="tomorrow__label">要交</span>
          <ul className="tomorrow__list">
            {tasks.map(todo => (
              <li key={todo.id}>
                <button type="button" className="tomorrow__task" onClick={onOpenPlan}>
                  <span className="tomorrow__box" aria-hidden="true" />
                  <span className="tomorrow__text">{todo.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
