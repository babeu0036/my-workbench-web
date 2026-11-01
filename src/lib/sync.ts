/* 云端同步：一台设备一个同步码，手机电脑共用同一份数据。
 * 后端是 Supabase 的一张表 sync(code, data, updated_at)。
 */

const BASE = 'https://ovoocdjdowiqzkoqxcjg.supabase.co'
const KEY = 'sb_publishable_vWA3KDJibQ9H7rMmjN4wkg_1E2oorh0'
const CODE_KEY = 'workbench.syncCode'
const META_KEY = 'workbench.syncMeta'
const PREFIX = 'workbench.'
const PULL_FLAG = 'workbench.pulledAt'

const headers = () => ({
  apikey: KEY,
  Authorization: 'Bearer ' + KEY,
  'Content-Type': 'application/json',
})

export function getSyncCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setSyncCode(code: string): void {
  try {
    localStorage.setItem(CODE_KEY, code.trim())
  } catch {
    /* ignore */
  }
}

/** 收集所有 workbench.* 的数据（同步码本身不算数据） */
function collect(): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(PREFIX)) continue
    if (key === CODE_KEY || key === META_KEY || key === PULL_FLAG) continue
    const value = localStorage.getItem(key)
    if (value !== null) out[key] = value
  }
  return out
}

function apply(data: Record<string, string>): void {
  Object.entries(data).forEach(([key, value]) => {
    if (!key.startsWith(PREFIX)) return
    try {
      localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  })
}

export async function upload(): Promise<string> {
  const code = getSyncCode()
  if (!code) return '还没填同步码'
  try {
    const res = await fetch(BASE + '/rest/v1/sync', {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([
        { code, data: collect(), updated_at: new Date().toISOString() },
      ]),
    })
    if (!res.ok) return '上传失败：' + res.status
    localStorage.setItem(META_KEY, JSON.stringify({ code, at: new Date().toISOString() }))
    return '已上传到云端'
  } catch {
    return '上传失败：网络不通'
  }
}

export async function download(reload = true): Promise<string> {
  const code = getSyncCode()
  if (!code) return '还没填同步码'
  try {
    const res = await fetch(
      BASE + '/rest/v1/sync?code=eq.' + encodeURIComponent(code) + '&select=data,updated_at',
      { headers: headers() },
    )
    if (!res.ok) return '下载失败：' + res.status
    const rows = (await res.json()) as { data: Record<string, string>; updated_at: string }[]
    if (!rows.length) return '云端还没有数据'
    apply(rows[0].data)
    localStorage.setItem(PULL_FLAG, rows[0].updated_at)
    if (reload) window.location.reload()
    return '已从云端下载'
  } catch {
    return '下载失败：网络不通'
  }
}

let timer: number | undefined
function schedulePush(): void {
  if (!getSyncCode()) return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    void upload()
  }, 1500)
}

/** 打开页面时：云端有更新就拉下来，云端空的就把本地推上去 */
async function pullOnStart(): Promise<void> {
  const code = getSyncCode()
  if (!code) return
  try {
    const res = await fetch(
      BASE + '/rest/v1/sync?code=eq.' + encodeURIComponent(code) + '&select=updated_at,data',
      { headers: headers() },
    )
    if (!res.ok) return
    const rows = (await res.json()) as { data: Record<string, string>; updated_at: string }[]
    if (!rows.length) {
      void upload()
      return
    }
    const remote = rows[0]
    const lastPulled = localStorage.getItem(PULL_FLAG)
    if (lastPulled === remote.updated_at) return
    apply(remote.data)
    localStorage.setItem(PULL_FLAG, remote.updated_at)
    window.location.reload()
  } catch {
    /* 离线就用本地的 */
  }
}

export function startSync(): void {
  window.addEventListener('workbench:change', schedulePush)
  void pullOnStart()
}
