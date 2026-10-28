import type { TabKey } from '../lib/types'

type Props = {
  active: TabKey
  onChange: (tab: TabKey) => void
  /** 待办上显示未完成条数，0 就不显示 */
  todoBadge?: number
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'home', label: '首页' },
  { key: 'todo', label: '待办' },
  { key: 'deadlines', label: '比赛' },
]

export default function TabBar({ active, onChange, todoBadge = 0 }: Props) {
  return (
    <nav className="tabs" role="tablist" aria-label="页面切换">
      {TABS.map(tab => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={isActive ? 'tab tab--active' : 'tab'}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {tab.key === 'todo' && todoBadge > 0 && (
              <span className="tab__badge">{todoBadge}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
