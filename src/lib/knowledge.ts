import type { Knowledge, KnowledgeType, LegacyAttachment } from './types'

/**
 * 知识库：五类类型 + 自动归类 + 读盘兜底 + 搜索筛选。
 *
 * 页面只管画，判断全在这里 —— 纯函数，能单独跑测试，不碰 localStorage。
 * 「自动归类」只在新建时用；编辑时类型以用户的选择为准，
 * 改个错别字不该把一条课程资料重新算成经验。
 *
 * 附件现在直接存 Supabase Storage：记录里只留 fileName / fileSize /
 * fileUrl / fileType 四项。早期版本存在 IndexedDB 的 `attachment`
 * 只在这里读一次、把元信息搬过来，文件本体不搬（也搬不动）。
 */

/** 五类，顺序就是筛选栏和表单里的顺序 */
export const KNOWLEDGE_TYPES: { key: KnowledgeType; label: string }[] = [
  { key: 'course', label: '课程' },
  { key: 'contest', label: '竞赛' },
  { key: 'job', label: '求职' },
  { key: 'rule', label: '制度' },
  { key: 'exp', label: '经验' },
]

const LABELS: Record<KnowledgeType, string> = {
  course: '课程',
  contest: '竞赛',
  job: '求职',
  rule: '制度',
  exp: '经验',
}

export function typeLabel(type: KnowledgeType): string {
  return LABELS[type]
}

export function isKnowledgeType(value: unknown): value is KnowledgeType {
  return (
    value === 'course' ||
    value === 'contest' ||
    value === 'job' ||
    value === 'rule' ||
    value === 'exp'
  )
}

/* ---------- 自动归类 ---------- */

/**
 * 按顺序判断，第一条命中的就是结果；全不中算「经验」。
 *
 * 顺序不能换：「期末复习比赛报名」既是课程又是竞赛，先判课程更符合直觉；
 * 「奖学金规定」会落到「制度」而不是「经验」，因为制度那条排在前面。
 */
const TYPE_WORDS: { type: KnowledgeType; words: string[] }[] = [
  { type: 'course', words: ['课件', '期末', '复习', '真题', '老师'] },
  { type: 'contest', words: ['比赛', '竞赛', '报名', '省奖', '获奖'] },
  { type: 'job', words: ['简历', '实习', '岗位', '面试', 'offer', '项目成果'] },
  { type: 'rule', words: ['评奖', '奖学金', '学分', '综测', '规定'] },
  { type: 'exp', words: ['报错', '解决', '配置', '流程', '注意'] },
]

/**
 * 猜一条记录属于哪类。
 *
 * 在标题、说明、文件名三处文字里找关键词 —— 只搜标题和说明的话，
 * 「只传一个文件」的记录必然落到经验，跟实际用途不符。
 * 文件名尤其重要：手头多是「高数期末真题.pdf」这种，标题常常只写「文件」。
 */
export function guessType(input: {
  title?: string
  summary?: string
  fileName?: string
} = {}): KnowledgeType {
  const text = `${input.title ?? ''} ${input.summary ?? ''} ${input.fileName ?? ''}`.toLowerCase()

  for (const group of TYPE_WORDS) {
    if (group.words.some(word => text.includes(word.toLowerCase()))) return group.type
  }
  return 'exp'
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

/* ---------- 附件字段 ---------- */

/** 表单交给写库函数的一份文件信息；url 空串 = 老附件，还没上传到云端 */
export type KnowledgeFileInput = {
  name: string
  size: number
  type: string
  url: string
}

type FileMeta = { name: string; size: number; type: string; url: string }

/** 从一条记录里读出文件信息；四个字段都没才算没有 */
function fileMetaOf(item: Partial<Knowledge>): FileMeta | null {
  const name = typeof item.fileName === 'string' ? item.fileName.trim() : ''
  if (!name) return null

  const size =
    typeof item.fileSize === 'number' && Number.isFinite(item.fileSize) && item.fileSize >= 0
      ? item.fileSize
      : 0
  const type = typeof item.fileType === 'string' ? item.fileType : ''
  const url = typeof item.fileUrl === 'string' ? item.fileUrl.trim() : ''

  return { name, size, type, url }
}

/** 早期 IndexedDB 附件：只有名字、大小、MIME，没有地址 */
function legacyFileMeta(value: unknown): FileMeta | null {
  if (!value || typeof value !== 'object') return null
  const legacy = value as Partial<LegacyAttachment>
  const name = typeof legacy.name === 'string' ? legacy.name.trim() : ''
  if (!name) return null

  return {
    name,
    size:
      typeof legacy.size === 'number' && Number.isFinite(legacy.size) && legacy.size >= 0
        ? legacy.size
        : 0,
    type: typeof legacy.mime === 'string' ? legacy.mime : '',
    url: '',
  }
}

/** 把文件信息写进记录：url 空着就不写这个键，免得留个打不开的空地址 */
function applyFile(target: Knowledge, file: FileMeta | null): void {
  if (!file) return
  target.fileName = file.name
  target.fileSize = file.size
  target.fileType = file.type
  if (file.url) target.fileUrl = file.url
}

function dropFile(target: Knowledge): void {
  delete target.fileName
  delete target.fileSize
  delete target.fileUrl
  delete target.fileType
}

/* ---------- 读盘兜底 ---------- */

/** 说明太长时截成标题的长度上限；列表判断「说明是不是已经当标题了」也用这个数 */
export const SUMMARY_TITLE_MAX = 24

/** 标题留空时用什么顶上：文件名 → 网站名 → 说明开头 → 未命名记录 */
export function titleFrom(input: {
  title?: string
  summary?: string
  url?: string
  fileName?: string
}): string {
  const title = (input.title ?? '').trim()
  if (title) return title

  const fileName = (input.fileName ?? '').trim()
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
  fileName?: string
}): boolean {
  return Boolean(
    (input.title ?? '').trim() ||
      (input.summary ?? '').trim() ||
      (input.url ?? '').trim() ||
      (input.fileName ?? '').trim(),
  )
}

/**
 * 一条记录从 localStorage 回来：什么都没留（标题、说明、链接、附件全空）才丢掉；
 * 类型不认识（含早期三类）按新规则重判一遍；
 * 链接重新过一遍 normalizeUrl，空的不写键；
 * 老 `attachment` 只搬元信息（文件名 / 大小 / MIME），文件本体早就没了，
 * 界面上照常显示名字，点预览时会提示重新上传；
 * 标题空着就用文件名 / 网站名 / 说明顶上，列表上总有个能认的标题。
 */
export function normalizeKnowledge(
  raw: unknown,
  index = 0,
  now: number = Date.now(),
): Knowledge | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Knowledge> & { attachment?: unknown }

  const title = typeof item.title === 'string' ? item.title.trim() : ''
  const summary = typeof item.summary === 'string' ? item.summary.trim() : ''
  const url = typeof item.url === 'string' ? normalizeUrl(item.url) : undefined
  const file = fileMetaOf(item) ?? legacyFileMeta(item.attachment)
  const fileName = file?.name ?? ''
  if (!hasContent({ title, summary, url, fileName })) return null

  const id =
    typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : now + index
  const createdAt =
    typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
      ? item.createdAt
      : now + index

  const knowledge: Knowledge = {
    id,
    // 老的 material / industry / mine / rule 都不能原样留着（会显示成不认识的标签），按内容重判
    type: isKnowledgeType(item.type) ? item.type : guessType({ title, summary, fileName }),
    title: titleFrom({ title, summary, url, fileName }),
    summary,
    createdAt,
  }

  if (url) knowledge.url = url
  applyFile(knowledge, file)

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

function asFileMeta(file: KnowledgeFileInput | null | undefined): FileMeta | null {
  if (!file) return null
  const name = file.name.trim()
  if (!name) return null
  return {
    name,
    size: Number.isFinite(file.size) && file.size >= 0 ? file.size : 0,
    type: file.type,
    url: file.url.trim(),
  }
}

export type KnowledgeInput = {
  title: string
  summary: string
  url?: string
  /** 文件：null / 不传 = 没有（更新时 null 表示清掉），有值就换成这个 */
  file?: KnowledgeFileInput | null
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
  const file = asFileMeta(input.file)
  const fileName = file?.name ?? ''
  // 什么都没写就不加，免得列表里出现一条点不开的空记录
  if (!hasContent({ title, summary, url, fileName })) return list

  const knowledge: Knowledge = {
    id: nextId(list, now),
    type: isKnowledgeType(input.type) ? input.type : guessType({ title, summary, fileName }),
    title: titleFrom({ title, summary, url, fileName }),
    summary,
    createdAt: now,
  }

  if (url) knowledge.url = url
  applyFile(knowledge, file)

  return [...list, knowledge]
}

/**
 * 改一条：标题、说明、链接、文件、类型都能改，而且都可以留空 ——
 * 标题空着会自动用文件名 / 网站名 / 说明顶上，所以列表不会出现没标题的行。
 * 四项全清空就整条不动（不许把记录改成没有内容）；
 * type 不合法就当没传，保留原来的；
 * file 传 undefined = 不动，传 null = 清掉，传对象 = 换掉。
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
    const file = patch.file === undefined ? fileMetaOf(item) : asFileMeta(patch.file)
    const fileName = file?.name ?? ''
    if (!hasContent({ title, summary, url, fileName })) return item

    const type = isKnowledgeType(patch.type) ? patch.type : item.type
    const next: Knowledge = {
      ...item,
      type,
      title: titleFrom({ title, summary, url, fileName }),
      summary,
    }

    if (url) next.url = url
    else delete next.url

    if (file) applyFile(next, file)
    else dropFile(next)

    return next
  })
}

export function removeKnowledge(list: Knowledge[], id: number): Knowledge[] {
  return list.filter(item => item.id !== id)
}

/* ---------- 读 ---------- */

export type KnowledgeFilter = 'all' | KnowledgeType

/**
 * 类型筛选 + 搜索一起做。搜索看标题、说明和文件名（链接不参与），
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
      item.summary.toLowerCase().includes(keyword) ||
      (item.fileName ?? '').toLowerCase().includes(keyword)
    )
  })
}

/** 新的在上；同一毫秒加的按 id 倒序，连点两次也不会看着像没加上 */
export function sortKnowledge(list: Knowledge[]): Knowledge[] {
  return [...list].sort((a, b) =>
    a.createdAt === b.createdAt ? b.id - a.id : b.createdAt - a.createdAt,
  )
}
