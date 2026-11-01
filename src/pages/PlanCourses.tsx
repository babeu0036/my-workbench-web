import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import CourseDayList from '../components/CourseDayList'
import CourseDetail from '../components/CourseDetail'
import CourseForm from '../components/CourseForm'
import CourseGrid from '../components/CourseGrid'
import CourseImport from '../components/CourseImport'
import { MAX_WEEK, addCourse, isActiveInWeek, removeCourse, weekNumberOf } from '../lib/courses'
import { formatWeekRange, weekKeyOffset, weekKeyOf, weekdayOf } from '../lib/date'
import { useIsWide } from '../lib/media'
import { UNCATEGORIZED_ID } from '../lib/todos'
import type { Course, Subject } from '../lib/types'

type Props = {
  courses: Course[]
  setCourses: Dispatch<SetStateAction<Course[]>>
  /** 学期第 1 周的周一，'' = 还没设 */
  semesterStart: string
  setSemesterStart: Dispatch<SetStateAction<string>>
  subjects: Subject[]
}

/**
 * 计划 · 课程表。
 *
 * 宽屏是 7 列 × 12 节的网格，窄屏换成按天列（手机上一列只有 45px，
 * 课名和教室根本放不下，硬挤没意义）。
 *
 * 「今天」和「这周上不上」是两件事：今天那一列永远高亮；
 * 是否变灰看学期第几周 —— 周次范围外、单双周对不上就灰着，但仍然显示，
 * 不然单双周一切换课就凭空消失。
 *
 * 翻周之后看的不是今天这周：周次、周区间、灰不灰、统计里的门数都跟着变，
 * 但「今天」高亮要收起来 —— 不然第 12 周的表里还亮着今天那一列，很误导。
 */
export default function PlanCourses({
  courses,
  setCourses,
  semesterStart,
  setSemesterStart,
  subjects,
}: Props) {
  const [formOpen, setFormOpen] = useState(false)
  // 从格子点进来时带上那一格的位置；右下角 + 打开时是 null
  const [seed, setSeed] = useState<{ weekday: number; startPeriod: number } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [settingOpen, setSettingOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  // 翻到第几周；null = 跟着今天走（也就是「本周」）
  const [viewWeek, setViewWeek] = useState<number | null>(null)

  const wide = useIsWide()
  const today = weekdayOf()
  const weekNo = weekNumberOf(semesterStart)
  // 页面上实际看的周次：翻过周就是 viewWeek，没翻过就是今天所在的周
  const showWeek = weekNo === null ? null : (viewWeek ?? weekNo)
  const isCurrentWeek = viewWeek === null || viewWeek === weekNo
  const detail = detailId === null ? null : (courses.find(item => item.id === detailId) ?? null)

  // 第 0 周、第 21 周都不是能上课的周，翻到 1 和 MAX_WEEK 就到头
  const canPrev = showWeek !== null && showWeek > 1
  const canNext = showWeek !== null && showWeek < MAX_WEEK

  // 课程能关联的只有真科目，未分类那一项是给任务用的
  const pickable = subjects.filter(subject => subject.id !== UNCATEGORIZED_ID)
  const activeCount =
    showWeek === null ? courses.length : courses.filter(item => isActiveInWeek(item, showWeek)).length

  const weekText =
    weekNo === null
      ? '设置学期开始'
      : isCurrentWeek
        ? weekNo < 1
          ? `还没开学 · 第 ${weekNo} 周`
          : `第 ${weekNo} 周`
        : `第 ${showWeek} 周`

  // 区间跟着翻：从本周的周一往后推 (showWeek - weekNo) 周
  const weekRange =
    showWeek === null || weekNo === null
      ? ''
      : formatWeekRange(weekKeyOffset(weekKeyOf(), showWeek - weekNo))

  /**
   * 翻一周。夹在 1~MAX_WEEK：翻回今天所在的周时顺手把 viewWeek 清成 null，
   * 这样「回到本周」按钮自己就消失了，不用两处各判一次。
   */
  function stepWeek(delta: number) {
    if (showWeek === null) return
    const next = Math.min(MAX_WEEK, Math.max(1, showWeek + delta))
    setViewWeek(next === weekNo ? null : next)
  }

  function addDrafts(drafts: Omit<Course, 'id'>[]) {
    setCourses(list => drafts.reduce((acc, draft) => addCourse(acc, draft), list))
  }

  /** 点空白格子 / 某天的 + ：预填位置再打开表单 */
  function openCreate(weekday: number, period: number) {
    setSeed({ weekday, startPeriod: period })
    setFormOpen(true)
  }

  /** 右下角 + ：不预填，表单自己落在今天 */
  function openBlankForm() {
    setSeed(null)
    setFormOpen(true)
  }

  return (
    <>
      <div className="page page--fab">
        <div className="courses__bar">
          <div className="courses__weekbar">
            <button
              type="button"
              className="courses__nav"
              onClick={() => stepWeek(-1)}
              disabled={!canPrev}
              aria-label="上一周"
            >
              ‹
            </button>

            <button
              type="button"
              className={weekNo === null ? 'courses__week courses__week--unset' : 'courses__week'}
              onClick={() => setSettingOpen(open => !open)}
              aria-expanded={settingOpen}
              aria-label="设置学期开始日期"
            >
              <span className="courses__weekno">{weekText}</span>
              {weekRange && <span className="courses__range">{weekRange}</span>}
            </button>

            <button
              type="button"
              className="courses__nav"
              onClick={() => stepWeek(1)}
              disabled={!canNext}
              aria-label="下一周"
            >
              ›
            </button>
          </div>

          <div className="courses__tools">
            {!isCurrentWeek && (
              <button
                type="button"
                className="btn btn--ghost courses__now"
                onClick={() => setViewWeek(null)}
              >
                回到本周
              </button>
            )}

            <button type="button" className="btn btn--ghost" onClick={() => setImportOpen(true)}>
              导入
            </button>
          </div>
        </div>

        {settingOpen && (
          <div className="form">
            <label className="field">
              <span className="field__label">学期第 1 周的周一</span>
              <input
                className="input input--date"
                type="date"
                value={semesterStart}
                onChange={e => setSemesterStart(e.target.value)}
                aria-label="学期开始日期"
              />
            </label>

            <p className="meta">
              {weekNo === null
                ? '填了才能算单双周和周次范围，现在所有课都先按「上」显示。'
                : `今天是第 ${weekNo} 周，单双周和周次范围都按这个算，改完立刻重算。`}
            </p>

            {semesterStart && (
              <button type="button" className="btn btn--ghost" onClick={() => setSemesterStart('')}>
                清除日期
              </button>
            )}
          </div>
        )}

        {weekNo === null && (
          <p className="courses__notice">
            还没设学期开始，单双周和周次范围算不出来 —— 点左上角的周次填一下
          </p>
        )}

        {courses.length === 0 ? (
          <div className="empty-block">
            <p className="empty">课表还是空的</p>
            <p className="meta">
              右上角「导入」可以一次粘贴整张课表；也可以点右下角 +，或者直接点下面表格里的空格子
            </p>
          </div>
        ) : (
          <p className="page__hint">
            共 {courses.length} 门课
            {showWeek !== null &&
              showWeek >= 1 &&
              (isCurrentWeek
                ? `，这周上 ${activeCount} 门`
                : `，第 ${showWeek} 周上 ${activeCount} 门`)}
          </p>
        )}

        {wide ? (
          <CourseGrid
            courses={courses}
            weekNo={showWeek}
            today={isCurrentWeek ? today : null}
            onSelect={course => setDetailId(course.id)}
            onCreate={openCreate}
          />
        ) : (
          <CourseDayList
            courses={courses}
            weekNo={showWeek}
            today={isCurrentWeek ? today : null}
            onSelect={course => setDetailId(course.id)}
            onCreate={openCreate}
          />
        )}
      </div>

      <button
        type="button"
        className="fab"
        onClick={openBlankForm}
        aria-label="添加课程"
        aria-haspopup="dialog"
        aria-expanded={formOpen}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {formOpen && (
        <CourseForm
          subjects={pickable}
          today={today}
          seed={seed ?? undefined}
          onClose={() => setFormOpen(false)}
          onAdd={draft => {
            addDrafts([draft])
            setFormOpen(false)
          }}
        />
      )}

      {importOpen && (
        <CourseImport
          existing={courses}
          onClose={() => setImportOpen(false)}
          onImport={addDrafts}
        />
      )}

      {detail && (
        <CourseDetail
          course={detail}
          weekNo={showWeek}
          isCurrentWeek={isCurrentWeek}
          subjects={pickable}
          onClose={() => setDetailId(null)}
          onRemove={() => {
            setCourses(list => removeCourse(list, detail.id))
            setDetailId(null)
          }}
        />
      )}
    </>
  )
}
