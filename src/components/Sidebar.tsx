import { useEffect, useState } from 'react'
import type { PlanSegment, Route } from '../lib/types'

type Props = {
  route: Route
  /** 到期提醒的条数，挂在「首页」右边当角标；0 就不显示 */
  dueCount: number
  /** 手机端抽屉是否打开；桌面端由 CSS 忽略这个值 */
  open: boolean
  onNavigate: (route: Route) => void
  onClose: () => void
}

type IconName = 'home' | 'plan' | 'goal' | 'knowledge' | 'review' | 'settings'

/** 16×16 的线框图标，不引第三方图标库，省一个依赖 */
const ICONS: Record<IconName, string> = {
  home: 'M3 7.6 8 3.2l5 4.4V13H3zM6.4 13V9.4h3.2V13',
  plan: 'M3 5.4h10V13H3zM3 8.2h10M6 3.4v3M10 3.4v3',
  // 准星：外圈 + 内圈，两个整圆用 arc 拼出来
  goal: 'M13.4 8A5.4 5.4 0 1 1 2.6 8A5.4 5.4 0 1 1 13.4 8M10.4 8A2.4 2.4 0 1 1 5.6 8A2.4 2.4 0 1 1 10.4 8',
  // 书本：原来「科目」那个图标，挪给知识库
  knowledge:
    'M3 3.6h3.4a1.6 1.6 0 0 1 1.6 1.6V13a1.4 1.4 0 0 0-1.4-1.2H3zM13 3.6H9.6A1.6 1.6 0 0 0 8 5.2V13a1.4 1.4 0 0 1 1.4-1.2H13z',
  review: 'M3 12.6V9M8 12.6V4.2M13 12.6V6.8',
  settings: 'M3 5.6h10M3 10.4h10M6.2 4.2v2.8M10.2 9v2.8',
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="nav__icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d={ICONS[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type Leaf = { key: string; label: string; route: Route; active: boolean }

/** 断点跟 CSS 里的 899px 对齐：窄屏时一级项只负责展开，不直接跳页 */
function useIsNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 899px)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)')
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return narrow
}

/**
 * 侧边栏。一级项六项：首页 / 计划 / 目标 / 知识库 / 复盘 / 设置。
 *
 * 只有「计划」带二级（课程表 / 任务 / 比赛）；其余点一下直接跳页。
 * 「科目」一级项已经去掉，科目页本身还留着，但这里没有入口。
 */
export default function Sidebar({ route, dueCount, open, onNavigate, onClose }: Props) {
  // 当前所在的一级项，跟 route.page 同名
  const activeGroup = route.page

  const isNarrow = useIsNarrow()

  /**
   * 只记「用户手动展开过的一级项」。
   * 当前所在的一级项始终算展开，所以这里不用存它 ——
   * 好处是从宽屏缩到窄屏时，桌面点过的组不会跟着一起展开。
   */
  const [expanded, setExpanded] = useState<string[]>([])

  const isOpen = (key: string) => key === activeGroup || expanded.includes(key)

  const toggle = (key: string) => {
    setExpanded(prev =>
      prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key],
    )
  }

  const goto = (next: Route) => {
    onNavigate(next)
    onClose()
  }

  /**
   * 窄屏下有二级的一级项，点它是「展开/收起」，不跳页也不关抽屉 ——
   * 否则抽屉一关，二级项根本来不及点。
   * 宽屏侧边栏一直露着，点一级项就直接跳它第一个二级页。
   */
  const handleGroup = (key: string, target: Route, hasChildren: boolean) => {
    if (isNarrow && hasChildren) {
      toggle(key)
      return
    }
    goto(target)
  }

  const planChildren: Leaf[] = (
    [
      { key: 'courses', label: '课程表' },
      { key: 'tasks', label: '任务' },
      { key: 'deadlines', label: '比赛' },
    ] as { key: PlanSegment; label: string }[]
  ).map(item => ({
    key: item.key,
    label: item.label,
    route: { page: 'plan', seg: item.key },
    active: route.page === 'plan' && route.seg === item.key,
  }))

  const groups: {
    key: string
    label: string
    icon: IconName
    route: Route
    children: Leaf[]
  }[] = [
    { key: 'home', label: '首页', icon: 'home', route: { page: 'home' }, children: [] },
    {
      key: 'plan',
      label: '计划',
      icon: 'plan',
      route: { page: 'plan', seg: 'courses' },
      children: planChildren,
    },
    { key: 'goal', label: '目标', icon: 'goal', route: { page: 'goal' }, children: [] },
    {
      key: 'knowledge',
      label: '知识库',
      icon: 'knowledge',
      route: { page: 'knowledge' },
      children: [],
    },
    { key: 'review', label: '复盘', icon: 'review', route: { page: 'review' }, children: [] },
    { key: 'settings', label: '设置', icon: 'settings', route: { page: 'settings' }, children: [] },
  ]

  return (
    <nav
      className={open ? 'sidebar sidebar--open' : 'sidebar'}
      aria-label="主导航"
      id="sidebar"
    >
      <div className="sidebar__brand">学习工作台</div>

      <ul className="nav">
        {groups.map(group => {
          const isActive = group.key === activeGroup
          const open = isOpen(group.key)

          return (
            <li key={group.key} className="nav__group">
              <button
                type="button"
                className={isActive ? 'nav__item nav__item--active' : 'nav__item'}
                aria-current={isActive ? 'page' : undefined}
                aria-expanded={group.children.length > 0 ? open : undefined}
                onClick={() => handleGroup(group.key, group.route, group.children.length > 0)}
              >
                <Icon name={group.icon} />
                <span className="nav__label">{group.label}</span>
                {group.key === 'home' && dueCount > 0 && (
                  <span className="nav__badge" aria-label={`${dueCount} 件任务临近截止`}>
                    {dueCount}
                  </span>
                )}
              </button>

              {group.children.length > 0 && (
                <ul className={open ? 'nav__children is-open' : 'nav__children'}>
                  {group.children.map(child => (
                    <li key={child.key}>
                      <button
                        type="button"
                        className={child.active ? 'nav__child nav__child--active' : 'nav__child'}
                        aria-current={child.active ? 'page' : undefined}
                        onClick={() => goto(child.route)}
                      >
                        {child.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
