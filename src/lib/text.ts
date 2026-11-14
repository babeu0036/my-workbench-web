/**
 * 两个跟「一段文字怎么显示」有关的小工具。
 * 都是纯函数，没有状态，也不认识任何业务类型。
 */

/** 看起来像一条能直接打开的网址：http / https 开头，中间没有空格 */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim())
}

/**
 * 中间省略：保留开头 head 个字符和结尾 tail 个字符，中间换成 …。
 *
 * 比「结尾加省略号」好在两头都留得住 —— 网址的域名在开头（看得出是哪个站），
 * 文件名或 ID 在结尾（认得出是哪一条）。
 *
 * 总长度不够 head + tail 加一个省略号时原样返回，不然会把内容吃掉：
 * 20 个字的网址硬按 24+12 切，会变成整条都是省略号。
 */
export function middleEllipsis(value: string, head = 24, tail = 12): string {
  const text = value.trim()
  if (text.length <= head + tail + 1) return text
  return `${text.slice(0, head)}…${text.slice(-tail)}`
}
