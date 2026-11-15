import { useEffect, useRef, useState } from 'react'
import type { RoadmapResult } from '../lib/roadmap'
import { getSyncCode, setSyncCode, upload, download } from '../lib/sync'

const PREFIX = 'workbench.'

/** 把 localStorage 里所有 workbench.* 打成一个对象 */
function snapshot(): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(PREFIX)) continue
    const value = localStorage.getItem(key)
    if (value !== null) out[key] = value
  }
  return out
}

/** 生成完那句提示：只报这次真补进去的东西，一条没补就直说 */
function describeRoadmap(added: RoadmapResult['added']): string {
  const bits: string[] = []
  if (added.stages > 0) bits.push(`${added.stages} 个阶段`)
  if (added.milestones > 0) bits.push(`${added.milestones} 个阶段目标`)

  if (bits.length === 0) {
    return added.career > 0
      ? '职业目标已填好，其余都已经是现成的。'
      : '路线已经是现成的了，没有重复添加。'
  }

  const head = `已生成 ${bits.join('、')}`
  return added.career > 0 ? `${head}，职业目标也填好了。` : `${head}。`
}

type Props = {
  /**
   * 「一键生成我的路线」：四个阶段 + 第一阶段的三个阶段目标 + 职业目标。
   * 合并式，返回这次补了几条（没变化时三个都是 0）。
   */
  onGenerateRoadmap: () => RoadmapResult['added']
}

export default function Settings({ onGenerateRoadmap }: Props) {
  const [code, setCode] = useState(() => getSyncCode())
  const [status, setStatus] = useState('')
  const [routeNote, setRouteNote] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCode(getSyncCode())
  }, [])

  async function handleUpload() {
    setSyncCode(code)
    setBusy(true)
    setStatus(await upload())
    setBusy(false)
  }

  async function handleDownload() {
    setSyncCode(code)
    setBusy(true)
    const msg = await download()
    setBusy(false)
    setStatus(msg)
  }

  function handleSaveCode() {
    setSyncCode(code)
    setStatus(code.trim() ? '同步码已保存，两台设备填同一个码即可' : '已清空同步码')
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'workbench-backup.json'
    a.click()
    URL.revokeObjectURL(url)
    setStatus('已导出 JSON')
  }

  function handleImport(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Record<string, string>
        Object.entries(data).forEach(([key, value]) => {
          if (key.startsWith(PREFIX)) localStorage.setItem(key, value)
        })
        window.location.reload()
      } catch {
        setStatus('文件格式不对')
      }
    }
    reader.readAsText(file)
  }

  function handleClear() {
    if (!window.confirm('清除后所有任务、目标都会消失，确定吗？')) return
    Object.keys(snapshot()).forEach(key => {
      if (key !== 'workbench.syncCode') localStorage.removeItem(key)
    })
    window.location.reload()
  }

  return (
    <div className="page">
      <h2 className="page__title">设置</h2>

      <h3 className="page__hint">我的路线</h3>
      <p className="meta">
        四个阶段、第一阶段的三条阶段目标，再顺手填好职业目标。已经有的不会重复添加，也不会盖掉你自己写的内容。
      </p>
      <button
        type="button"
        className="btn btn--primary route-seed"
        onClick={() => setRouteNote(describeRoadmap(onGenerateRoadmap()))}
      >
        一键生成我的路线
      </button>
      {routeNote && (
        <p className="meta" role="status">
          {routeNote}
        </p>
      )}

      <h3 className="page__hint" style={{ marginTop: 24 }}>云端同步</h3>
      <p className="meta">两台设备填同一个同步码，数据就通了。</p>
      <div className="field-row">
        <input
          className="input"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="同步码，比如 wxy-2026"
        />
        <button type="button" className="btn btn--primary" onClick={handleSaveCode}>
          保存
        </button>
      </div>
      <div className="field-row" style={{ marginTop: 8 }}>
        <button type="button" className="btn btn--ghost" onClick={handleUpload} disabled={busy}>
          上传到云端
        </button>
        <button type="button" className="btn btn--ghost" onClick={handleDownload} disabled={busy}>
          从云端下载
        </button>
      </div>
      {status && <p className="meta">{status}</p>}

      <h3 className="page__hint" style={{ marginTop: 24 }}>数据备份</h3>
      <div className="field-row">
        <button type="button" className="btn btn--ghost" onClick={handleExport}>
          导出 JSON
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
          导入 JSON
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleImport(file)
          e.target.value = ''
        }}
      />

      <h3 className="page__hint" style={{ marginTop: 24 }}>危险操作</h3>
      <button type="button" className="btn btn--danger" onClick={handleClear}>
        清除全部数据
      </button>
    </div>
  )
}
