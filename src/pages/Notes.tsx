import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import ConfirmDelete from '../components/ConfirmDelete'
import { formatUpdatedAt } from '../lib/date'
import { createNoteId, filterNotes, toSummary } from '../lib/notes'
import type { Note } from '../lib/types'

/** 输入停手多久才写一次盘 */
const DEBOUNCE_MS = 500

type Props = {
  notes: Note[]
  setNotes: Dispatch<SetStateAction<Note[]>>
}

export default function NotesPage({ notes, setNotes }: Props) {
  const [keyword, setKeyword] = useState('')
  // null = 列表态；有值 = 编辑态，编辑哪条由 id 定，跟数组顺序无关
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  // 编辑页的删除二次确认
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // 编辑态的三个真相：正在编辑谁、输入框里是什么、已经落盘的是什么
  const idRef = useRef<number | null>(null)
  const draftRef = useRef('')
  const savedRef = useRef('')
  // 这次编辑有没有真的改过东西（决定返回时要不要刷新 updatedAt）
  const dirtyRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  /**
   * 落盘。touch = false 时只换内容、不动 updatedAt ——
   * 输入过程中列表顺序才不会跟着跳。
   */
  const persist = useCallback(
    (id: number, content: string, touch: boolean) => {
      setNotes(prev => {
        if (!prev.some(n => n.id === id)) {
          return [...prev, { id, content, updatedAt: Date.now() }]
        }
        return prev.map(n =>
          n.id === id ? { ...n, content, updatedAt: touch ? Date.now() : n.updatedAt } : n,
        )
      })
    },
    [setNotes],
  )

  // 输入防抖：停手 500ms 存一次内容，不改时间戳
  useEffect(() => {
    if (editingId === null) return
    if (draft === savedRef.current) return
    if (!draft.trim()) return // 空内容不落盘，退出时按「丢弃」处理

    const timer = window.setTimeout(() => {
      timerRef.current = null
      persist(editingId, draftRef.current, false)
      savedRef.current = draftRef.current
    }, DEBOUNCE_MS)

    timerRef.current = timer
    return () => {
      window.clearTimeout(timer)
      if (timerRef.current === timer) timerRef.current = null
    }
  }, [draft, editingId, persist])

  // 切 Tab 导致页面卸载时，把最后不到 500ms 的输入保住（不动顺序）
  useEffect(() => {
    return () => {
      clearTimer()
      const id = idRef.current
      const content = draftRef.current
      if (id === null || !content.trim() || content === savedRef.current) return
      persist(id, content, false)
    }
  }, [persist])

  function openNew() {
    const id = createNoteId(notes)
    idRef.current = id
    draftRef.current = ''
    savedRef.current = ''
    dirtyRef.current = false
    setEditingId(id)
    setDraft('')
  }

  function openNote(note: Note) {
    idRef.current = note.id
    draftRef.current = note.content
    savedRef.current = note.content
    dirtyRef.current = false
    setEditingId(note.id)
    setDraft(note.content)
  }

  /** 退出编辑态，把四个引用和两个 state 一次清干净 */
  function resetEditor() {
    idRef.current = null
    draftRef.current = ''
    savedRef.current = ''
    dirtyRef.current = false
    setEditingId(null)
    setDraft('')
    setConfirmingDelete(false)
  }

  /**
   * 返回 = 结束这次编辑。
   * 只有「非空 + 真的改过」才写回并刷新 updatedAt；
   * 空草稿一律丢弃 —— 绝不因为内容空就去删整条。
   */
  function close() {
    clearTimer()
    const id = editingId
    const content = draft

    if (id !== null && content.trim() !== '' && dirtyRef.current) {
      persist(id, content, true)
    }

    resetEditor()
  }

  /**
   * 编辑页的删除：唯一的破坏性入口，直接按 id 摘掉这条。
   * 不经过「清空内容」那条间接路径 —— 内容清空只代表草稿被丢弃，不代表要删笔记。
   */
  function deleteCurrent() {
    const id = editingId
    if (id === null) return

    // 先取消待触发的防抖，并把编辑态引用清掉，避免卸载兜底又把内容写回来
    clearTimer()
    resetEditor()
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  /** 列表里的删除：按 id 摘掉（编辑态已被清掉，不会影响当前草稿） */
  function removeNote(id: number) {
    clearTimer()
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const visible = filterNotes(notes, keyword)
  const searching = keyword.trim() !== ''

  if (editingId !== null) {
    return (
      <div className="page">
        <div className="editor__bar">
          <button type="button" className="btn btn--ghost" onClick={close}>
            ‹ 返回
          </button>
          <span className="editor__hint">输入会自动保存</span>
        </div>

        <textarea
          className="editor__textarea"
          value={draft}
          onChange={e => {
            const value = e.target.value
            setDraft(value)
            draftRef.current = value
            dirtyRef.current = true
          }}
          placeholder="随手记点什么…"
          aria-label="笔记内容"
          autoFocus
        />

        <p className="meta">{Array.from(draft).length} 字</p>

        <div className="editor__actions">
          {confirmingDelete ? (
            <>
              <button type="button" className="btn btn--danger-solid" onClick={deleteCurrent}>
                确定删除
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmingDelete(false)}>
                取消
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--ghost btn--danger"
              onClick={() => setConfirmingDelete(true)}
            >
              删除这条笔记
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="field-row">
        <input
          className="input"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="搜索笔记内容…"
          aria-label="搜索笔记"
        />
        <button type="button" className="btn btn--primary" onClick={openNew}>
          新建
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="empty">还没有笔记，新建一条试试。</p>
      ) : visible.length === 0 ? (
        <div className="empty-block">
          <p className="empty">没有匹配「{keyword.trim()}」的笔记</p>
          <button type="button" className="btn btn--ghost" onClick={() => setKeyword('')}>
            清空搜索
          </button>
        </div>
      ) : (
        <>
          <ul className="list">
            {visible.map(note => (
              <li key={note.id} className="note">
                <button type="button" className="note__open" onClick={() => openNote(note)}>
                  <span className="note__text">{toSummary(note.content)}</span>
                  <span className="note__time">{formatUpdatedAt(note.updatedAt)}</span>
                </button>
                <ConfirmDelete onConfirm={() => removeNote(note.id)} />
              </li>
            ))}
          </ul>
          <p className="meta">
            {searching ? `找到 ${visible.length} 条 · 共 ${notes.length} 条` : `共 ${notes.length} 条`}
          </p>
        </>
      )}
    </div>
  )
}
