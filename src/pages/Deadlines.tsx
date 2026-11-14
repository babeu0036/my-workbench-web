import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import DuePicker from '../components/DuePicker'
import { dayKey, formatDateCn } from '../lib/date'
import {
  addDeadline,
  contestLabel,
  isClosed,
  isSignupSoon,
  nextStep,
  removeDeadline,
  sortDeadlines,
  stepLabel,
  validateDeadline,
} from '../lib/deadlines'
import type { MilestoneOption } from '../lib/milestones'
import type { Deadline } from '../lib/types'

type Props = {
  deadlines: Deadline[]
  setDeadlines: Dispatch<SetStateAction<Deadline[]>>
  /** 「服务于」的选项：各阶段的里程碑。一条都没有时整行不显示 */
  milestones: MilestoneOption[]
}

/**
 * 比赛清单。一条比赛有三个时间点：报名截止（必填）、比赛开始 / 结束（可选）。
 * 列表里报名截止决定这条还算不算「有效」——一过就整条变灰、挂「已截止」；
 * 但倒计时不浪费，会顺延到下一个还没过的时间点（比如「距开赛 4 天」）。
 *
 * 「服务于」跟任务那边是同一个下拉：选一条里程碑，这场比赛就算在它名下，
 * 列表里挂一个短名小标签。选「日常事务」就不挂。
 */
export default function Deadlines({ deadlines, setDeadlines, milestones }: Props) {
  const [name, setName] = useState('')
  const [signupEnd, setSignupEnd] = useState(dayKey())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  // undefined = 日常事务。表单里用空串表示「没选」，落盘时不写这个键
  const [goalId, setGoalId] = useState<number | undefined>(undefined)
  const [error, setError] = useState('')

  function add() {
    const input = { name, signupEnd, startDate, endDate, goalId }
    const message = validateDeadline(input)
    if (message) {
      setError(message)
      return
    }

    setDeadlines(list => addDeadline(list, input))
    // 名称和比赛日期清掉，报名截止回到今天 —— 下一条大概率不是同一天截止；
    // 归属也清回日常事务，免得下一条悄悄挂在上一条的里程碑上
    setName('')
    setStartDate('')
    setEndDate('')
    setSignupEnd(dayKey())
    setGoalId(undefined)
    setError('')
  }

  // 一次渲染里所有计算用同一个「现在」，免得跨零点时前后对不上
  const now = Date.now()
  const sorted = sortDeadlines(deadlines, now)
  const milestoneById = new Map(milestones.map(item => [item.id, item]))

  // 「服务于」按阶段分组，跟任务面板一样：平铺成一长条反而难找
  const groups: { stage: string; items: MilestoneOption[] }[] = []
  for (const option of milestones) {
    const last = groups[groups.length - 1]
    if (last && last.stage === option.stageTitle) last.items.push(option)
    else groups.push({ stage: option.stageTitle, items: [option] })
  }

  return (
    <div className="page">
      <div className="form">
        <input
          className="input"
          value={name}
          onChange={e => {
            setName(e.target.value)
            setError('')
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') add()
          }}
          placeholder="比赛名称，比如 蓝桥杯"
          aria-label="比赛名称"
        />

        <DuePicker
          value={signupEnd}
          onChange={value => {
            setSignupEnd(value)
            setError('')
          }}
          label="报名截止"
        />

        <div className="field-row">
          <label className="field">
            <span className="field__label">比赛开始（可选）</span>
            <input
              className="input input--date"
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value)
                setError('')
              }}
            />
          </label>

          <label className="field">
            <span className="field__label">比赛结束（可选）</span>
            <input
              className="input input--date"
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value)
                setError('')
              }}
            />
          </label>
        </div>

        {groups.length > 0 && (
          <label className="field">
            <span className="field__label">服务于</span>
            <select
              className="input input--select"
              value={goalId === undefined ? '' : String(goalId)}
              onChange={e => {
                setGoalId(e.target.value === '' ? undefined : Number(e.target.value))
                setError('')
              }}
            >
              <option value="">日常事务</option>
              {groups.map(group => (
                <optgroup key={group.stage} label={group.stage}>
                  {group.items.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}

        {error && <p className="form__error">{error}</p>}

        <button type="button" className="btn btn--primary form__submit" onClick={add}>
          添加比赛
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="empty">还没有比赛，加一个 DDL 盯着。</p>
      ) : (
        <ul className="list">
          {sorted.map(item => {
            const closed = isClosed(item, now)
            const soon = isSignupSoon(item, now)
            const step = nextStep(item, now)
            const contest = contestLabel(item)
            const goal = item.goalId === undefined ? undefined : milestoneById.get(item.goalId)

            // 倒计时跟着它自己的时间点走：报名截止的写在报名行，开赛/结束的写在比赛行
            const signupCountdown = !closed && step?.kind === 'signup' ? stepLabel(step) : ''
            const contestCountdown = step && step.kind !== 'signup' ? stepLabel(step) : ''

            return (
              <li key={item.id} className={closed ? 'row row--closed' : 'row'}>
                <span className="row__body">
                  <span className="row__text">{item.name}</span>

                  <span className={soon ? 'row__date row__date--alert' : 'row__date'}>
                    报名截止 {formatDateCn(item.signupEnd)}
                    {signupCountdown && (
                      <>
                        {' · '}
                        <span className="nowrap">{signupCountdown}</span>
                      </>
                    )}
                  </span>

                  {contest && (
                    <span className="row__date">
                      比赛 {contest}
                      {contestCountdown && (
                        <>
                          {' · '}
                          <span className="nowrap">{contestCountdown}</span>
                        </>
                      )}
                    </span>
                  )}
                </span>

                {closed && <span className="status status--closed">已截止</span>}

                <span className="row__actions">
                  {goal && (
                    <span className="row__goal" title={`服务于：${goal.title}`}>
                      {goal.short}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn--ghost btn--danger"
                    onClick={() => setDeadlines(list => removeDeadline(list, item.id))}
                    aria-label={`删除比赛：${item.name}`}
                  >
                    删除
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
