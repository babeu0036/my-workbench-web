import { useEffect, useRef, useState } from 'react'
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

export default function Settings() {
  const [code, setCode] = useState(() => getSyncCode())
  const [status, setStatus] = useState('')
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

      <h3 className="page__hint">云端同步</h3>
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
