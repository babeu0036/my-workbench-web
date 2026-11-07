import type { Knowledge, KnowledgeType } from './types'

/**
 * 知识库：四条类型 + 自动归类 + 读盘兜底 + 搜索筛选。
 *
 * 页面只管画，判断全在这里 —— 纯函数，能单独跑测试，不碰 localStorage。
 * 「自动归类」只在新建时用；编辑时类型以用户的选择为准，
 * 改个错别字不该把一条行业动态重新算成我的笔记。
 */

/** 四类，顺序就是筛选栏和表单里的顺序 */
export const KNOWLEDGE_TYPES: { key: KnowledgeType; label: string }[] = [
  { key: 'rule', label: '规则文件' },
  { key: 'material', label: '学习资料' },
  { key: 'industry', label: '行业动态' },
  { key: 'mine', label: '我的笔记' },
]

const LABELS: Record<KnowledgeType, string> = {
  rule: '规则文件',
  material: '学习资料',
  industry: '行业动态',
  mine: '我的笔记',
}

export function typeLabel(type: KnowledgeType): string {
  return LABELS[type]
}

export function isKnowledgeType(value: unknown): value is KnowledgeType {
  return value === 'rule' || value === 'material' || value === 'industry' || value === 'mine'
}

/* ---------- 自动归类 ---------- */

/** 按顺序判断：规则 → 资料（含 http）→ 行业 → 我的笔记 */
const RULE_WORDS = ['评奖', '奖学金', '学分', '综测', '章程', '通知']
const MATERIAL_WORDS = ['教程', '手册', '视频', '文档']
const INDUSTRY_WORDS = ['招聘', '岗位', '薪资', '行业', '芯片', '市场']

const hasWord = (text: string, words: string[]) => words.some(word => text.includes(word))

/**
 * 猜一条记录属于哪类。
 *
 * 在标题、说明、链接三处文字里找关键词 —— 只搜标题和说明的话，
 * 「只贴一个链接」的记录必然落到 mine，跟实际用途不符。
 * 顺序不能换：「奖学金」同时出现在行业新闻里时，仍然算规则文件。
 */
export function guessType(input: {
  title?: string
  summary?: string
  url?: string
} = {}): KnowledgeType {
  const text = `${input.title ?? ''} ${input.summary ?? ''}`
  if (hasWord(text, RULE_WORDS)) return 'rule'

  // 链接只看「有没有协议头」，不要求整个 URL 合法 —— 用户可能只贴了一半
  const hasLink = /https?:\/\//i.test(`${text} ${input.url ?? ''}`)
  if (hasLink || hasWord(text, MATERIAL_WORDS)) return 'material'

  if (hasWord(text, INDUSTRY_WORDS)) return 'industry'
  return 'mine'
}

/* ---------- 链接 ---------- */

/**
 * 存链接前先归一：没写协议就补 https://。
 *
 * 补完还得像个地址（主机名里有点、两头的点去掉），不然「参考书」这种
 * 随手写的词会变成一条打不开的 https://参考书，点开是错误页。
 * 认不出就返回 undefined，当作没填链接 —— 标题和说明照样存下来。
 */
export function normalizeUrl(raw: string): string | undefined {
  const value = raw.trim()
  if (!value) return undefined

  const fixed = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(fixed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    const host = url.hostname
    if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) return undefined
    return fixed
  } catch {
    return undefined
  }
}

/* ---------- 读盘兜底 ---------- */

/**
 * 一条记录从 localStorage 回来：标题和说明缺一个就认不出来，丢掉；
 * 类型不认识归 mine；链接重新过一遍 normalizeUrl，空的不写键。
 */
export function normalizeKnowledge(
  raw: unknown,
  index = 0,
  now: number = Date.now(),
): Knowledge | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Knowledge>

  const title = typeof item.title === 'string' ? item.title.trim() : ''
  const summary = typeof item.summary === 'string' ? item.summary.trim() : ''
  if (!title || !summary) return null

  const id =
    typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : now + index
  const createdAt =
    typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
      ? item.createdAt
      : now + index

  const knowledge: Knowledge = {
    id,
    type: isKnowledgeType(item.type) ? item.type : 'mine',
    title,
    summary,
    createdAt,
  }

  if (typeof item.url === 'string') {
    const url = normalizeUrl(item.url)
    if (url) knowledge.url = url
  }

  return knowledge
}

export function normalizeKnowledgeList(list: unknown, now: number = Date.now()): Knowledge[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item, index) => normalizeKnowledge(item, index, now))
    .filter((item): item is Knowledge => item !== null)
}

/* ---------- 写 ---------- */

/** 新 id：同一毫秒里连加两条也不会撞 */
function nextId(list: { id: number }[], now: number): number {
  const max = list.reduce((acc, item) => (item.id > acc ? item.id : acc), 0)
  return now > max ? now : max + 1
}

export type KnowledgeInput = {
  title: string
  summary: string
  url?: string
  type: KnowledgeType
}

export function addKnowledge(
  list: Knowledge[],
  input: KnowledgeInput,
  now: number = Date.now(),
): Knowledge[] {
  const title = input.title.trim()
  const summary = input.summary.trim()
  if (!title || !summary) return list

  const knowledge: Knowledge = {
    id: nextId(list, now),
    type: isKnowledgeType(input.type) ? input.type : guessType(input),
    title,
    summary,
    createdAt: now,
  }
  const url = normalizeUrl(input.url ?? '')
  if (url) knowledge.url = url

  return [...list, knowledge]
}

/**
 * 改一条：标题、说明、链接、类型都能改。
 * 标题或说明改成空就整条不动（不许把记录改成没有内容）；
 * 链接传空字符串 = 清掉这个键；type 不合法就当没传，保留原来的。
 */
export function updateKnowledge(
  list: Knowledge[],
  id: number,
  patch: Partial<KnowledgeInput>,
): Knowledge[] {
  return list.map(item => {
    if (item.id !== id) return item

    const title = patch.title === undefined ? item.title : patch.title.trim()
    const summary = patch.summary === undefined ? item.summary : patch.summary.trim()
    if (!title || !summary) return item

    const type = isKnowledgeType(patch.type) ? patch.type : item.type
    const next: Knowledge = { ...item, title, summary, type }

    if (patch.url !== undefined) {
      const url = normalizeUrl(patch.url)
      if (url) next.url = url
      else delete next.url
    }

    return next
  })
}

export function removeKnowledge(list: Knowledge[], id: number): Knowledge[] {
  return list.filter(item => item.id !== id)
}

/* ---------- 读 ---------- */

export type KnowledgeFilter = 'all' | KnowledgeType

/**
 * 类型筛选 + 搜索一起做。搜索只看标题和一句话说明（链接不参与），
 * 忽略大小写、忽略两头空格；空搜索词等于不搜。
 */
export function filterKnowledge(
  list: Knowledge[],
  filter: KnowledgeFilter = 'all',
  query = '',
): Knowledge[] {
  const keyword = query.trim().toLowerCase()
  return list.filter(item => {
    if (filter !== 'all' && item.type !== filter) return false
    if (!keyword) return true
    return (
      item.title.toLowerCase().includes(keyword) ||
      item.summary.toLowerCase().includes(keyword)
    )
  })
}

/** 新的在上；同一毫秒加的按 id 倒序，连点两次也不会看着像没加上 */
export function sortKnowledge(list: Knowledge[]): Knowledge[] {
  return [...list].sort((a, b) =>
    a.createdAt === b.createdAt ? b.id - a.id : b.createdAt - a.createdAt,
  )
}
