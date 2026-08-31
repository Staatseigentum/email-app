import { useCallback, useEffect, useRef, useState } from 'react'
import type { MessageDetail, MessageSummary, TempMailbox } from '../../../shared/types'
import { MessageList, type Density, type ListFilter } from './MessageList'
import { MessageView } from './MessageView'
import { formatDate } from '../lib/format'
import { IconCheck, IconClock, IconCopy, IconPlus, IconTrash } from './Icons'

const api = window.mailwave
const REFRESH_MS = 12_000

export function TempMailView(props: {
  density: Density
  newMailTick: number
  onToast: (text: string, tone?: 'info' | 'success' | 'error') => void
  onOpenExternal: (url: string) => void
}): JSX.Element {
  const [boxes, setBoxes] = useState<TempMailbox[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [detail, setDetail] = useState<MessageDetail | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [busy, setBusy] = useState<'create' | 'remove' | null>(null)
  const [copied, setCopied] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ListFilter>('all')

  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId
  const active = boxes.find((b) => b.id === activeId) ?? null

  const loadBoxes = useCallback(async () => {
    const res = await api.temp.list()
    if (res.ok) {
      setBoxes(res.data)
      setActiveId((cur) => cur ?? res.data[0]?.id ?? null)
    }
  }, [])

  const loadMessages = useCallback(
    async (id: string, showSpinner = true) => {
      if (showSpinner) setLoadingList(true)
      const res = await api.temp.messages(id)
      if (activeIdRef.current !== id) return
      setLoadingList(false)
      if (res.ok) setMessages(res.data)
      else props.onToast(res.error, 'error')
    },
    [props]
  )

  useEffect(() => {
    void loadBoxes()
  }, [loadBoxes])

  // aktives Postfach im Main-Prozess setzen (Polling + Benachrichtigungen)
  useEffect(() => {
    api.temp.activate(activeId)
    return () => {
      api.temp.activate(null)
    }
  }, [activeId])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    setSelectedUid(null)
    setDetail(null)
    void loadMessages(activeId)
    const t = setInterval(() => {
      if (activeIdRef.current) void loadMessages(activeIdRef.current, false)
    }, REFRESH_MS)
    return () => clearInterval(t)
  }, [activeId, loadMessages])

  // neue Mail vom Main-Prozess signalisiert -> Liste auffrischen
  useEffect(() => {
    if (props.newMailTick && activeIdRef.current) void loadMessages(activeIdRef.current, false)
  }, [props.newMailTick, loadMessages])

  const createBox = useCallback(async () => {
    setBusy('create')
    const res = await api.temp.create()
    setBusy(null)
    if (res.ok) {
      await loadBoxes()
      setActiveId(res.data.id)
      setPickerOpen(false)
      props.onToast(`Neue Wegwerf-Adresse: ${res.data.address}`, 'success')
    } else {
      props.onToast(res.error, 'error')
    }
  }, [loadBoxes, props])

  const removeBox = useCallback(
    async (id: string) => {
      setBusy('remove')
      const res = await api.temp.remove(id)
      setBusy(null)
      if (res.ok) {
        setActiveId((cur) => (cur === id ? null : cur))
        await loadBoxes()
        props.onToast('Wegwerf-Adresse verworfen', 'info')
      } else props.onToast(res.error, 'error')
    },
    [loadBoxes, props]
  )

  const openMessage = useCallback(
    async (uid: number) => {
      if (!activeId) return
      setSelectedUid(uid)
      setLoadingDetail(true)
      setDetail(null)
      const res = await api.temp.message(activeId, uid)
      setLoadingDetail(false)
      if (res.ok) {
        setDetail(res.data)
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)))
      } else props.onToast(res.error, 'error')
    },
    [activeId, props]
  )

  const copyAddress = useCallback(() => {
    if (!active) return
    void navigator.clipboard.writeText(active.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }, [active])

  const saveAttachment = useCallback(
    async (index: number) => {
      if (!activeId || selectedUid === null) return
      const res = await api.temp.saveAttachment(activeId, selectedUid, index)
      if (res.ok && res.data.saved) props.onToast('Anhang gespeichert', 'success')
      else if (!res.ok) props.onToast(res.error, 'error')
    },
    [activeId, selectedUid, props]
  )

  const markAll = useCallback(async () => {
    if (!activeId) return
    setMessages((prev) => prev.map((m) => ({ ...m, seen: true })))
    await api.temp.markAllSeen(activeId)
  }, [activeId])

  const visibleMessages = messages.filter((m) => {
    if (filter === 'unread' && m.seen) return false
    if (filter === 'flagged' && !m.flagged) return false
    if (filter === 'attachments' && !m.hasAttachments) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      m.subject.toLowerCase().includes(q) ||
      m.fromName.toLowerCase().includes(q) ||
      m.snippet.toLowerCase().includes(q)
    )
  })

  if (boxes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
          <IconClock width={28} height={28} />
        </div>
        <div>
          <h2 className="text-lg font-bold">Wegwerf-Postfach</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Erstelle eine Einweg-Adresse für Newsletter, Downloads oder Tests. Du kannst sie
            behalten, solange du willst, und jederzeit eine neue anlegen.
          </p>
        </div>
        <button
          onClick={createBox}
          disabled={busy === 'create'}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:brightness-110 disabled:opacity-50"
        >
          <IconPlus width={16} height={16} />
          {busy === 'create' ? 'Wird erstellt…' : 'Wegwerf-Adresse erstellen'}
        </button>
        <p className="text-[11px] text-slate-400">Postfächer von mail.tm · nur Empfang</p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
            <IconClock width={20} height={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              Aktuelle Wegwerf-Adresse
            </div>
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-bold">{active?.address ?? '—'}</span>
              <button
                onClick={copyAddress}
                className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"
                title="Adresse kopieren"
              >
                {copied ? (
                  <IconCheck width={15} height={15} className="text-emerald-500" />
                ) : (
                  <IconCopy width={15} height={15} />
                )}
              </button>
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              Adressen ({boxes.length})
            </button>
            {pickerOpen && (
              <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#161d30]">
                {boxes.map((b) => (
                  <div
                    key={b.id}
                    className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                      b.id === activeId ? 'bg-brand-500/10' : 'hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActiveId(b.id)
                        setPickerOpen(false)
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate font-medium">{b.address}</span>
                      <span className="block text-[10px] text-slate-400">
                        erstellt {formatDate(b.createdAt)}
                      </span>
                    </button>
                    <button
                      onClick={() => removeBox(b.id)}
                      disabled={busy === 'remove'}
                      className="rounded p-1 text-slate-400 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
                      title="Verwerfen"
                    >
                      <IconTrash width={13} height={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={createBox}
                  disabled={busy === 'create'}
                  className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-500/10 disabled:opacity-50 dark:text-brand-300"
                >
                  <IconPlus width={13} height={13} />
                  {busy === 'create' ? 'Wird erstellt…' : 'Neue Adresse'}
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Postfächer von{' '}
          <button onClick={() => props.onOpenExternal('https://mail.tm')} className="underline">
            mail.tm
          </button>{' '}
          · nur Empfang · aktualisiert alle 12 s
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <MessageList
          messages={visibleMessages}
          loading={loadingList}
          selectedUid={selectedUid}
          query={query}
          filter={filter}
          accountName={active?.address}
          checked={EMPTY}
          selectMode={false}
          readOnly
          onQuery={setQuery}
          onFilter={setFilter}
          onSync={() => activeId && void loadMessages(activeId)}
          onToggleSelectMode={NOOP}
          onSelect={openMessage}
          onToggleCheck={NOOP}
          onClearChecked={NOOP}
          onBulkMarkSeen={markAll}
          onBulkDelete={NOOP}
          onToggleFlag={NOOP}
          onDelete={NOOP}
        />
        <MessageView
          detail={detail}
          loading={loadingDetail}
          hasSelection={selectedUid !== null}
          theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
          onReply={NOOP}
          onReplyAll={NOOP}
          onForward={NOOP}
          onDelete={NOOP}
          onOpenExternal={props.onOpenExternal}
          onSaveAttachment={saveAttachment}
          readOnly
        />
      </div>
    </div>
  )
}

const EMPTY = new Set<number>()
const NOOP = (): void => {}
