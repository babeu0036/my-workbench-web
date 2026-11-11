/**
 * 任务的类型：学习任务要有科目，琐事不需要科目。
 * 老数据没有这个字段，迁移时一律算 study。
 */
export type TodoKind = 'study' | 'chore'

export type Todo = {
  id: number
  text: string
  done: boolean
  /** 属于哪个科目；空字符串 = 没有科目（老数据、或者琐事） */
  subjectId: string
  /** 学习 / 琐事。琐事的 subjectId 一定是空的 */
  kind: TodoKind
  /** 创建时间戳。老数据没有这个字段，迁移时拿它原来的 id 顶上 */
  createdAt: number
  /** 完成时间戳。没完成时没有，撤销完成时要清掉 */
  doneAt?: number
  /**
   * 截止日期，形如 2026-11-03（本地日期，不是时间戳）。
   * 新任务必填；改造前的老任务没有这一项，就不提醒，也不编一个假日期出来。
   */
  dueDate?: string
  /**
   * 挂在哪个成就下。有值 = 目标页的任务，只在目标页出现 ——
   * 计划·任务、首页、复盘统计都按 `withoutAchievement` 把它们排除掉，
   * 免得同一件事在三个地方各算一遍。
   */
  achievementId?: number
}

/**
 * 一条成就（目标页上的大块）。下面的任务通过 `Todo.achievementId` 挂过来。
 *
 * `doneAt` 有值 = 已点亮。它没有手动按钮：某个成就的任务数 ≥ 1 且全部完成时
 * 自动写时间戳，有任务被取消勾选就删掉这个键（见 lib/achievements.ts）。
 */
export type Achievement = {
  id: number
  title: string
  /** 备注，可选。空字符串按没有处理 */
  note?: string
  /** 点亮时间戳。清掉时删键，不置 null */
  doneAt?: number
}

export type Deadline = {
  id: number
  name: string
  /** 报名截止，必填。形如 2026-11-01 */
  signupEnd: string
  /** 比赛开始 / 结束，都是可选的 */
  startDate?: string
  endDate?: string
}

/**
 * 知识库条目的类型：课程资料 / 竞赛项目 / 成果档案 / 规章制度 / 经验技巧。
 * 新建时按 `guessType` 自动判断，用户可以手动改；手动改过就是最终值。
 *
 * 老数据的 `material / industry / mine / job` 都已经取消，
 * 读盘时按新关键词重判成这五类之一。
 */
export type KnowledgeType = 'course' | 'contest' | 'result' | 'rule' | 'exp'

/**
 * 早期版本存在浏览器 IndexedDB 里的附件元信息。
 *
 * **只用于读旧数据迁移**：新代码一律用 Knowledge 上的 fileName / fileSize /
 * fileUrl / fileType，IndexedDB 那套已经删干净了，不再读写。
 */
export type LegacyAttachment = {
  key: string
  name: string
  size: number
  mime: string
}

/**
 * 知识库的一条记录：一个标题、一句话说明，链接和附件都可选。
 * `url` 和文件那四个字段，没有这个键 = 没有，不存空值。
 */
export type Knowledge = {
  id: number
  type: KnowledgeType
  title: string
  /** 原始链接。保存时补全协议头，打不开的就不写进来 */
  url?: string
  /** 附件原名（带后缀），列表和面板上显示的就是它 */
  fileName?: string
  /** 字节数，用来显示 1.2 MB */
  fileSize?: number
  /** Supabase Storage 的公开地址；早期留在本地的老附件没有这一项 */
  fileUrl?: string
  /** MIME，浏览器认不出时是空字符串 */
  fileType?: string
  /**
   * 自己打的标签，用来在大类下面再分一层（「高数」「嵌入式」）。
   * 一律存数组、空着就是 `[]`，读的时候不用再判 undefined。
   * 展示时前面加 `#`，搜索也认它。
   */
  tags: string[]
  /** 一句话说明。可以不填 —— 收藏行业动态时就是空着进来的，列表里显示「补一句说明」 */
  summary: string
  createdAt: number
}

/**
 * 行业动态里的一条：从 Supabase 的 `feed_items` 表读出来的，**不是**知识库记录 ——
 * 只有点了「收藏」才会转成一条 Knowledge 存下来。
 *
 * pubDate 保留表里的原样字符串（`pub_date` 是 2026-11-07T05:01:17+00:00 这种 UTC ISO），
 * 展示时才转成本机时间，解析不出来就是空。
 */
export type FeedItem = {
  title: string
  link: string
  /** 来源站名，用来在每条右下角标一下是哪家的 */
  source: string
  pubDate: string
}

/**
 * 行业动态的缓存，存在 `workbench.feedCache`。
 *
 * 它会跟着云同步上传（几 KB），所以换台设备可能拿到别的地方的旧缓存 ——
 * 新鲜度一律按**本机时间**算（见 lib/feed.ts 的 isFresh）。
 */
export type FeedCache = {
  fetchedAt: number
  items: FeedItem[]
}

export type Note = {
  id: number
  content: string
  /** 最近一次保存的时间戳，输入过程中不变 */
  updatedAt: number
}

export type Subject = {
  id: string
  name: string
  /**
   * 筛选胶囊上用的短名。只有名字特别长的科目才给 ——
   * 计划页的筛选条一共七八颗胶囊，360px 下全用全名会折成三排。
   * 没有就退回 name，页面上仍然显示全名。
   */
  short?: string
}

/**
 * 一段目标周期：本学期、暑假、或者自己起的一个名字。
 * start / end 都是 10 字符日期键（2026-09-01），end 含当天。
 * 周期之间允许重叠 —— 学期里套一个暑假是正常的事。
 */
export type GoalPeriod = {
  id: number
  /** 页面上那个小标签写什么：「本学期」「暑假」「11.02 那周」 */
  title: string
  start: string
  end: string
}

/**
 * 一条目标。挂在一个周期下，一个周期下想有几条就有几条。
 * 没有「结算」这个状态：勾上就是完成，取消勾就回到未完成。
 */
export type Goal = {
  id: number
  /** 属于哪个周期（GoalPeriod.id） */
  periodId: number
  text: string
  done: boolean
  /** 勾上的时间，用来显示「11月6日 完成」；取消勾就清掉 */
  doneAt?: number
}

/**
 * 今日状态：😄 不错 / 😐 一般 / 😮‍💨 有点累。
 * 一天记一次，可以改，按日期键存（2026-11-01 → 'good'）。
 */
export type Mood = 'good' | 'ok' | 'tired'

/** 单双周：每周都上 / 只单周 / 只双周。按「学期第几周」判断，不是日历周 */
export type CourseWeeks = 'all' | 'odd' | 'even'

export type Course = {
  id: number
  name: string
  /** 关联科目，可选；没有就是 '' 或不填，课程表不依赖它 */
  subjectId?: string
  /** 1 = 周一 … 7 = 周日 */
  weekday: number
  /** 第几节开始 / 结束，都是 1-12 */
  startPeriod: number
  endPeriod: number
  weeks: CourseWeeks
  /** 学期第几周开始 / 结束，如 1 / 16 */
  weekStart: number
  weekEnd: number
  location?: string
}

export type PlanSegment = 'courses' | 'tasks' | 'deadlines'
export type SubjectSegment = 'tasks' | 'mistakes'

/**
 * 侧边栏能去的地方，一个对象就是当前所在位置。
 *
 * 一级项是六个：首页 / 计划 / 目标 / 知识库 / 复盘 / 设置。
 * 只有「计划」带二级（课程表 / 任务 / 比赛），复盘不再是二级结构，
 * 直接就是「数据」那一页。
 *
 * `subject`（科目页）暂时没有入口 —— 侧边栏去掉了科目一级项，
 * 但路由和页面都留着，首页到期提醒里点科目名还能进来。
 */
export type Route =
  | { page: 'home' }
  | { page: 'plan'; seg: PlanSegment }
  | { page: 'goal' }
  | { page: 'knowledge' }
  | { page: 'subject'; id: string; seg: SubjectSegment }
  | { page: 'review' }
  | { page: 'settings' }
