import { useState } from 'react'
import { dayKey, dayKeyOffset } from '../lib/date'

/** 快捷日期：今天 / 明天 / 后天。再加就是一周了，起不到「催」的作用 */
const QUICK = [
  { days: 0, label: '今天' },
  { days: 1, label: '明天' },
  { days: 2, label: '后天' },
]

type Props = {
  /** 2026-11-03 形式的本地日期；空字符串 = 还没选 */
  value: string
  onChange: (value: string) => void
  /** 左边的说明文字。任务的语义是「截止」，比赛的语义是「报名截止」 */
  label?: string
  /** 要不要「今天 / 明天 / 后天」那三个快捷胶囊。成就任务不要，它们不催 */
  quick?: boolean
  /**
   * 日期可以不填。空着时只留一个虚线小按钮，点开才出现日期框 ——
   * 成就任务是激励用的，先让人把想做的事写下来，日期想加再加。
   */
  optional?: boolean
}

/**
 * 截止日期选择：三个快捷胶囊 + 原生日期框，两者改的是同一个值。
 * 首页添加面板、科目页输入条、比赛表单共用这一份，样式和行为不会走偏。
 *
 * 两种例外走同一个组件：
 * - `quick={false}`：不显示快捷胶囊，只剩日期框；
 * - `optional`：日期可以不填，没填时折叠成「设个日期（可以不填）」，
 *   点开后有日期框和「清除」，清空后又收回去。
 *
 * 不做自己的日历弹层：原生 input[type=date] 在手机上直接唤起系统选择器，
 * 又轻又不会挡键盘。
 */
export default function DuePicker({
  value,
  onChange,
  label = '截止',
  quick = true,
  optional = false,
}: Props) {
  // 可选的日期：有值（编辑老任务）就展开着，没值就折叠
  const [open, setOpen] = useState(!optional || value !== '')

  if (optional) {
    return (
      <div className="due-picker due-picker--optional">
        <span className="due-picker__label">{label}</span>

        {open ? (
          <>
            <input
              className="input input--date"
              type="date"
              value={value}
              onChange={e => onChange(e.target.value)}
              aria-label={label}
              autoFocus
            />
            <button
              type="button"
              className="due-picker__clear"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              清除
            </button>
          </>
        ) : (
          <button
            type="button"
            className="due-picker__toggle"
            onClick={() => setOpen(true)}
            aria-expanded={false}
          >
            设个日期（可以不填）
          </button>
        )}
      </div>
    )
  }

  const today = dayKey()
  const quickList = QUICK.map(item => ({ ...item, key: dayKeyOffset(today, item.days) }))

  return (
    <div className="due-picker">
      {quick && (
        <div className="due-picker__row" role="group" aria-label={`${label}快捷选择`}>
          <span className="due-picker__label">{label}</span>
          {quickList.map(item => (
            <button
              key={item.days}
              type="button"
              className={item.key === value ? 'choice choice--on' : 'choice'}
              aria-pressed={item.key === value}
              onClick={() => onChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <input
        className="input input--date"
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
      />
    </div>
  )
}
