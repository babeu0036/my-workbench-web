import type { Attachment, Knowledge, KnowledgeType } from './types'
import { normalizeAttachment } from './files'

/**
 * 知识库：三类类型 + 自动归类 + 读盘兜底 + 搜索筛选。
 *
 * 页面只管画，判断全在这里 —— 纯函数，能单独跑测试，不碰 localStorage。
 * 「自动归类」只在新建时用；编辑时类型以用户的选择为准，
 * 改个错别字不该把一条行业动态重新算成我的笔记。
 *
 * 附件只处理元信息（key / 文件名 / 大小），文件本体在 lib/files.ts 的 IndexedDB 里。
 */

/** 三类，顺序就是筛选栏和表单里的顺序 */
export const KNOWLEDGE_TYPES: { key: KnowledgeType; label: string }[] = [
  { key: 'material', label: '学习资料' },
  { key: 'industry', label: '行业动态' },
  { key: 'mine', label: '我的笔记' },
]

const LABELS: Record<KnowledgeType, string> = {
  material: '学习资料',
  industry: '行业动态',
  mine: '我的笔记',
}

export function typeLabel(type: KnowledgeType): string {
  return LABELS[type]
}

export function isKnowledgeType(value: unknown): value is KnowledgeType {
  return value === 'material' || value === 'industry' || value === 'mine'
}

/* ---------- 自动归类 ---------- */

/** 按顺序判断：资料（含 http）→ 行业 → 我的笔记 */
const MATERIAL_WORDS = ['教程', '手册', '视频', '文档']
const INDUSTRY_WORDS = ['招聘', '岗位', '薪资', '行业', '芯片', '市场']

const hasWord = (text: string, words: string[]) => words.some(word => text.includes(word))

/**
 * 猜一条记录属于哪类。
 *
 * 在标题、说明、链接、文件名四处文字里找关键词 —— 只搜标题和说明的话，
 * 「只贴一个链接」或「只传一个文件」的记录必然落到 mine，跟实际用途不符。
 * 文件名尤其重要：手头多是「高数复习手册.pdf」这种，标题常常只写「文件」。
 * 顺序不能换：带 http 的一律算学习资料，哪怕正文里出现「招聘」。
 */
export function guessType(input: {
  title?: string
  summary?: string
  url?: string
  fileName?: string
} = {}): KnowledgeType {
  const text = `${input.title ?? ''} ${input.summary ?? ''} ${input.fileName ?? ''}`

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

/** 说明太长时截成标题的长度上限；列表判断「说明是不是已经当标题了」也用这个数 */
export const SUMMARY_TITLE_MAX = 24

/** 标题留空时用什么顶上：文件名 → 网站名 → 说明开头 → 未命名记录 */
export function titleFrom(input: {
  title?: string
  summary?: string
  url?: string
  attachment?: Attachment | null
}): string {
  const title = (input.title ?? '').trim()
  if (title) return title

  const fileName = input.attachment?.name.trim()
  if (fileName) return withoutExt(fileName)

  const raw = (input.url ?? '').trim()
  if (raw) {
    try {
      const host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname
      if (host.includes('.')) return host
    } catch {
      /* 认不出是什么地址，接着往下找 */
    }
  }

  const summary = (input.summary ?? '').trim()
  if (summary) {
    return summary.length > SUMMARY_TITLE_MAX
      ? `${summary.slice(0, SUMMARY_TITLE_MAX)}…`
      : summary
  }

  return '未命名记录'
}

/** 只去掉最后一段扩展名：「a.tar.gz」→「a.tar」，「.gitignore」不动 */
function withoutExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/** 有一条能认出来的内容就算数：标题、说明、有效链接、附件，任意一项 */
function hasContent(input: {
  title?: string
  summary?: string
  url?: string
  attachment?: Attachment | null
}): boolean {
  return Boolean(
    (input.title ?? '').trim() ||
      (input.summary ?? '').trim() ||
      (input.url ?? '').trim() ||
      input.attachment,
  )
}

/**
 * 一条记录从 localStorage 回来：什么都没留（标题、说明、链接、附件全空）才丢掉；
 * 类型不认识（含早期被取消的 rule）按新规则重判一遍；
 * 链接重新过一遍 normalizeUrl，空的不写键；
 * 标题空着就用文件名 / 网站名 / 说明顶上，列表上总有个能认的标题。
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
  const url = typeof item.url === 'string' ? normalizeUrl(item.url) : undefined
  const attachment = normalizeAttachment(item.attachment)
  if (!hasContent({ title, summary, url, attachment })) return null

  const id =
    typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : now + index
  const createdAt =
    typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
      ? item.createdAt
      : now + index

  const knowledge: Knowledge = {
    id,
    // 老数据的「规则文件」已经取消，不能原样留着（会显示成第四种标签），按内容重判
    type: isKnowledgeType(item.type)
      ? item.type
      : guessType({ title, summary, url, fileName: attachment?.name }),
    title: titleFrom({ title, summary, url, attachment }),
    summary,
    createdAt,
  }

  if (url) knowledge.url = url
  if (attachment) knowledge.attachment = attachment

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
  /** 附件元信息：null = 明确清掉，undefined = 不动（更新时靠这个区分） */
  attachment?: Attachment | null
  type: KnowledgeType
}

export function addKnowledge(
  list: Knowledge[],
  input: KnowledgeInput,
  now: number = Date.now(),
): Knowledge[] {
  const title = input.title.trim()
  const summary = input.summary.trim()
  const url = normalizeUrl(input.url ?? '')
  const attachment = normalizeAttachment(input.attachment)
  // 什么都没写就不加，免得列表里出现一条点不开的空记录
  if (!hasContent({ title, summary, url, attachment })) return list

  const knowledge: Knowledge = {
    id: nextId(list, now),
    type: isKnowledgeType(input.type)
      ? input.type
      : guessType({ ...input, fileName: attachment?.name }),
    title: titleFrom({ title, summary, url, attachment }),
    summary,
    createdAt: now,
  }

  if (url) knowledge.url = url
  if (attachment) knowledge.attachment = attachment

  return [...list, knowledge]
}

/**
 * 改一条：标题、说明、链接、附件、类型都能改，而且都可以留空 ——
 * 标题空着会自动用文件名 / 网站名 / 说明顶上，所以列表不会出现没标题的行。
 * 四项全清空就整条不动（不许把记录改成没有内容）；
 * type 不合法就当没传，保留原来的；
 * attachment 传 undefined = 不动，传 null = 清掉，传对象 = 换掉。
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
    const url = patch.url === undefined ? item.url : normalizeUrl(patch.url)
    const attachment =
      patch.attachment === undefined ? item.attachment : normalizeAttachment(patch.attachment)
    if (!hasContent({ title, summary, url, attachment })) return item

    const type = isKnowledgeType(patch.type) ? patch.type : item.type
    const next: Knowledge = {
      ...item,
      type,
      title: titleFrom({ title, summary, url, attachment }),
      summary,
    }

    if (url) next.url = url
    else delete next.url

    if (attachment) next.attachment = attachment
    else delete next.attachment

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
