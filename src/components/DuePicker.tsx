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
}

/**
 * 截止日期选择：三个快捷胶囊 + 原生日期框，两者改的是同一个值。
 * 首页添加面板和科目页输入条共用这一份，样式和行为不会走偏。
 *
 * 不做自己的日历弹层：原生 input[type=date] 在手机上直接唤起系统选择器，
 * 又轻又不会挡键盘。
 */
export default function DuePicker({ value, onChange }: Props) {
  const today = dayKey()
  const quick = QUICK.map(item => ({ ...item, key: dayKeyOffset(today, item.days) }))

  return (
    <div className="due-picker">
      <div className="due-picker__row" role="group" aria-label="截止日期快捷选择">
        <span className="due-picker__label">截止</span>
        {quick.map(item => (
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

      <input
        className="input input--date"
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="截止日期"
      />
    </div>
  )
}
