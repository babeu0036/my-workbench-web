import { countdownText, targetDays } from '../lib/career'
import type { Career } from '../lib/types'

type Props = {
  career: Career
  /** 点「去设置」跳到目标页那块三行输入 */
  onOpen: () => void
}

/**
 * 首页顶部的职业目标卡：一句话愿景 + 角色 + 距目标日期还有几天。
 *
 * 三样都可能空着 —— 空着不编内容，用灰字提示该填什么，右边留一个「去设置」。
 * 天数在 30 天以内变红，过了目标日就写「已经过了 N 天」，不显示负数。
 */
export default function CareerCard({ career, onOpen }: Props) {
  const days = targetDays(career)
  const tone = days === undefined ? '' : days < 0 ? 'career__count--over' : days <= 30 ? 'career__count--near' : ''

  return (
    <section className="card career" aria-label="职业目标">
      <div className="career__head">
        <span className="card__title">职业目标</span>
        <button type="button" className="btn btn--ghost career__btn" onClick={onOpen}>
          去设置
        </button>
      </div>

      <p className={career.vision ? 'career__vision' : 'career__vision career__vision--empty'}>
        {career.vision || '还没写想做成的那件事'}
      </p>

      <div className="career__meta">
        <span className={career.role ? 'career__role' : 'career__role career__role--empty'}>
          {career.role || '还没定角色'}
        </span>
        {days === undefined ? (
          <span className="career__count career__count--empty">还没定目标日期</span>
        ) : (
          <span className={tone ? `career__count ${tone}` : 'career__count'}>
            距 {career.targetDate} {countdownText(days)}
          </span>
        )}
      </div>
    </section>
  )
}
