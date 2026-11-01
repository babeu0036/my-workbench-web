import { useEffect, useState } from 'react'

/** 跟 index.css 里的侧边栏断点保持一致：≥900px 是宽屏 */
const QUERY = '(min-width: 900px)'

/**
 * 现在是不是宽屏。
 *
 * 课程表在宽屏和窄屏是两套完全不同的结构（7×12 网格 / 按天列表），
 * 光靠 CSS 藏起来会渲染两份、也点不清，所以这里用 matchMedia 直接二选一。
 * 侧边栏那种「同一个结构换个位置」的情况仍然交给 CSS。
 */
export function useIsWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = () => setWide(mql.matches)
    // 首帧之后再看一次：初始化时窗口可能刚被设为别的尺寸
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return wide
}
