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
  { key: 'course', label: '课程资料' },
  { key: 'contest', label: '竞赛项目' },
  { key: 'result', label: '成果档案' },
  { key: 'rule', label: '规章制度' },
  { key: 'exp', label: '经验技巧' },
]

/** `type === ''` 的显示名。筛选栏在五类前面也用它 */
export const UNSORTED_LABEL = '未分类'

const LABELS: Record<KnowledgeType, string> = {
  course: '课程资料',
  contest: '竞赛项目',
  result: '成果档案',
  rule: '规章制度',
  exp: '经验技巧',
}

/** 空字符串也给得出名字（未分类），列表标签和搜索文案都靠它 */
export function typeLabel(type: KnowledgeType | ''): string {
  return type === '' ? UNSORTED_LABEL : (LABELS[type] ?? UNSORTED_LABEL)
}

export function isKnowledgeType(value: unknown): value is KnowledgeType {
  return (
    value === 'course' ||
    value === 'contest' ||
    value === 'result' ||
    value === 'rule' ||
    value === 'exp'
  )
}

/* ---------- 标签 ---------- */

/** 一条记录最多留几个标签：够分小类就行，再多列表就成一行乱码了 */
export const MAX_TAGS = 10
/** 单个标签的字符上限，粘贴一大段话进来也不至于撑破一行 */
export const MAX_TAG_LENGTH = 20

/**
 * 把用户写的一串字变成标签数组。
 *
 * 中英文逗号、分号、顿号都当分隔符 —— 中文输入法下面打出「，」太正常了，
 * 只认半角逗号会让人以为标签没生效。顺手去掉开头的 `#`（展示时本来就会加），
 * 去重不区分大小写，空的丢掉。
 */
export function normalizeTags(input: string[] | string | undefined | null): string[] {
  if (!input) return []
  const chunks = Array.isArray(input)
    ? input
    : String(input).split(/[,，、;；]/)

  const tags: string[] = []
  for (const raw of chunks) {
    const tag = String(raw ?? '')
      .trim()
      .replace(/^#+/, '')
      .trim()
    if (!tag) continue
    if (tags.some(item => item.toLowerCase() === tag.toLowerCase())) continue
    tags.push(tag.slice(0, MAX_TAG_LENGTH))
    if (tags.length >= MAX_TAGS) break
  }
  return tags
}

/** 标签显示成「#高数 #嵌入式」；空数组给空串，调用方直接判真假 */
export function tagsText(tags: string[] | undefined): string {
  return (tags ?? []).map(tag => `#${tag}`).join(' ')
}

/* ---------- 自动归类 ---------- */

/**
 * 按顺序判断，第一条命中的就是结果；全不中算「经验」。
 *
 * 顺序不能换：「期末复习比赛报名」既是课程又是竞赛，先判课程更符合直觉；
 * 「奖学金规定」会落到「制度」而不是「经验」，因为制度那条排在前面。
 *
 * contest 这一组**故意不收「获奖」**：它太泛，「获奖记录」「获奖证书」
 * 该算成果档案，收进来就会被竞赛先抢走。
 */
const TYPE_WORDS: { type: KnowledgeType; words: string[] }[] = [
  { type: 'course', words: ['课件', '期末', '复习', '真题', '老师', '作业'] },
  { type: 'contest', words: ['比赛', '竞赛', '报名', '省奖', '备赛'] },
  { type: 'result', words: ['简历', '证书', '项目成果', '获奖', '实习'] },
  { type: 'rule', words: ['评奖', '奖学金', '学分', '综测', '规定', '通知'] },
  { type: 'exp', words: ['报错', '解决', '配置', '流程', '技巧'] },
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
    // 空串表示「未分类」，读盘时原样留着；
    // 老的不认识的值（含早期的 material / industry / mine / job）按内容重判一遍
    type:
      item.type === ''
        ? ''
        : isKnowledgeType(item.type)
          ? item.type
          : guessType({ title, summary, fileName }),
    title: titleFrom({ title, summary, url, fileName }),
    summary,
    // 老记录没有这个键，读盘时统一补成空数组，后面就不用到处判 undefined
    tags: normalizeTags(item.tags),
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
  /** 标签：不传 = 不动（更新时）；传空数组 = 清空 */
  tags?: string[]
  /** 五类之一；空字符串 = 先不分类 */
  type: KnowledgeType | ''
}

/**
 * 新建一条。`type` 空着就是「未分类」—— 一句话速记不该被逼着挑分类，
 * 也不再自动猜（猜出来的东西用户没确认过，反而要在详情里改回来）。
 */
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
    type: input.type === '' ? '' : isKnowledgeType(input.type) ? input.type : '',
    title: titleFrom({ title, summary, url, fileName }),
    summary,
    tags: normalizeTags(input.tags),
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
 * type 传空字符串 = 改成「未分类」，传不认识的值 = 保留原来的；不传 = 不动；
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

    // 空串是有效值（补选之后又想放回未分类），不认识的值才忽略
    const type: KnowledgeType | '' =
      patch.type === undefined
        ? item.type
        : patch.type === '' || isKnowledgeType(patch.type)
          ? patch.type
          : item.type
    const next: Knowledge = {
      ...item,
      type,
      title: titleFrom({ title, summary, url, fileName }),
      summary,
      // 不传 tags = 保持原样；传空数组才是清空
      tags: patch.tags === undefined ? item.tags : normalizeTags(patch.tags),
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

/** `unsorted` = 只看未分类（type 为空字符串） */
export type KnowledgeFilter = 'all' | 'unsorted' | KnowledgeType

/**
 * 类型筛选 + 搜索一起做。
 *
 * `unsorted` 不是第六种类型，只是「type 为空」的另一个说法 —— 五类的取值一个没变。
 * 搜索看标题、说明、标签、文件名和**类型标签**（搜「竞赛」能出竞赛项目，
 * 搜「未分类」也出得来）；链接不参与。忽略大小写、忽略两头空格，空搜索词等于不搜。
 */
export function filterKnowledge(
  list: Knowledge[],
  filter: KnowledgeFilter = 'all',
  query = '',
): Knowledge[] {
  const keyword = query.trim().toLowerCase()
  return list.filter(item => {
    if (filter === 'unsorted') {
      if (item.type !== '') return false
    } else if (filter !== 'all' && item.type !== filter) {
      return false
    }
    if (!keyword) return true
    return (
      item.title.toLowerCase().includes(keyword) ||
      item.summary.toLowerCase().includes(keyword) ||
      (item.fileName ?? '').toLowerCase().includes(keyword) ||
      (item.tags ?? []).some(tag => tag.toLowerCase().includes(keyword)) ||
      typeLabel(item.type).includes(keyword)
    )
  })
}

/** 新的在上；同一毫秒加的按 id 倒序，连点两次也不会看着像没加上 */
export function sortKnowledge(list: Knowledge[]): Knowledge[] {
  return [...list].sort((a, b) =>
    a.createdAt === b.createdAt ? b.id - a.id : b.createdAt - a.createdAt,
  )
}

/* ---------- 存储用量 ---------- */

/** bucket 配额：1 GB。这是给自己看的预算，不是 Supabase 那边真实的上限 */
export const STORAGE_QUOTA = 1024 * 1024 * 1024

/** 到九成就提醒，留一点余量收拾 */
export const STORAGE_WARN_RATIO = 0.9

/**
 * 已用空间 = 所有记录 fileSize 之和。
 *
 * 注意它只统计**记录里记着的大小**：删记录不会清 bucket 里的文件
 * （anon 没有 DELETE 权限），所以后台看到的实际占用会比这个数字大一点。
 */
export function storageUsed(list: Knowledge[]): number {
  return list.reduce((sum, item) => {
    const size = item.fileSize
    return sum + (typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : 0)
  }, 0)
}

export type StorageUsage = {
  used: number
  quota: number
  /** used / quota，可能大于 1；用来画进度或再判断都行 */
  ratio: number
  /** 到 90%（含）就是 true */
  warn: boolean
}

export function storageUsage(list: Knowledge[]): StorageUsage {
  const used = storageUsed(list)
  return {
    used,
    quota: STORAGE_QUOTA,
    ratio: used / STORAGE_QUOTA,
    warn: used >= STORAGE_QUOTA * STORAGE_WARN_RATIO,
  }
}
