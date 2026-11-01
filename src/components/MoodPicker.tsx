import { MOOD_OPTIONS } from '../lib/mood'
import type { Mood } from '../lib/types'

type Props = {
  /** 今天记的是什么，没记过是 null */
  value: Mood | null
  onPick: (mood: Mood) => void
}

/**
 * 今日状态。三个按钮，一天一条记录。
 *
 * 「一天只能选一次」不是靠禁用按钮实现的：再点一个就是覆盖今天那条，
 * 数据里一天永远只有一条，所以既能改，也不会出现两条。
 */
export default function MoodPicker({ value, onPick }: Props) {
  return (
    <section className="card mood" aria-label="今日状态">
      <div className="card__head">
        <span className="card__title">今日状态</span>
        {value && <span className="card__note">再点一下能改</span>}
      </div>

      <div className="mood__row" role="group" aria-label="今天感觉怎么样">
        {MOOD_OPTIONS.map(option => {
          const active = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              className={active ? 'mood__btn mood__btn--on' : 'mood__btn'}
              onClick={() => onPick(option.value)}
              aria-pressed={active}
            >
              <span className="mood__emoji" aria-hidden="true">
                {option.emoji}
              </span>
              <span className="mood__label">{option.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
