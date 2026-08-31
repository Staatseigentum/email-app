import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ComposePayload,
  ConnectionStatus,
  MailAccount,
  MailboxNode,
  MessageDetail,
  MessageSummary
} from '../../shared/types'
import { AccountRail } from './components/AccountRail'
import { AccountPopover } from './components/AccountPopover'
import { Sidebar } from './components/Sidebar'
import { MessageList, type Density, type ListFilter } from './components/MessageList'
import { MessageView } from './components/MessageView'
import { ComposeModal, type ComposeSeed } from './components/ComposeModal'
import { AccountModal } from './components/AccountModal'
import { Onboarding } from './components/Onboarding'
import { TitleBar } from './components/TitleBar'
import { StatusBar } from './components/StatusBar'
import { TempMailView } from './components/TempMailView'
import { Toasts, type Toast, type ToastTone } from './components/Toasts'

const api = window.mailwave

let toastSeq = 0

export default function App(): JSX.Element {
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus['state']>>({})
  const [statusMsg, setStatusMsg] = useState<Record<string, string | undefined>>({})
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [mailboxes, setMailboxes] = useState<MailboxNode[]>([])
  const [activeMailbox, setActiveMailbox] = useState('INBOX')
  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [detail, setDetail] = useState<MessageDetail | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [query, setQuery] = useState('')
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [selectMode, setSelectMode] = useState(false)
  const [compose, setCompose] = useState<ComposeSeed | null>(null)
  const [accountModal, setAccountModal] = useState<{ account?: MailAccount } | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [view, setView] = useState<'mail' | 'temp' | 'settings'>('mail')
  const [accountPopover, setAccountPopover] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [tempTick, setTempTick] = useState(0)
  const [lastSync, setLastSync] = useState<string | undefined>()
  const [density] = useState<Density>((localStorage.getItem('density') as Density) || 'cozy')
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  )

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null

  const listReqId = useRef(0)
  const activeAccountIdRef = useRef<string | null>(null)
  const mailboxRef = useRef('INBOX')
  const accountsRef = useRef<MailAccount[]>([])
  activeAccountIdRef.current = activeAccountId
  mailboxRef.current = activeMailbox
  accountsRef.current = accounts

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    []
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback(
    (text: string, tone: ToastTone = 'info', action?: Toast['action']) => {
      const id = `t${++toastSeq}`
      setToasts((prev) => [...prev.slice(-3), { id, text, tone, action }])
    },
    []
  )

  const loadAccounts = useCallback(async () => {
    const res = await api.accounts.list()
    if (res.ok) {
      setAccounts(res.data)
      setActiveAccountId((cur) => cur ?? res.data[0]?.id ?? null)
    }
  }, [])

  const loadMailboxes = useCallback(async (accountId: string) => {
    const res = await api.mail.mailboxes(accountId)
    if (res.ok) setMailboxes(res.data)
  }, [])

  const loadMessages = useCallback(
    async (accountId: string, mailbox: string) => {
      const reqId = ++listReqId.current
      setLoadingList(true)
      const res = await api.mail.messages(accountId, mailbox, 0)
      if (reqId !== listReqId.current) return
      setLoadingList(false)
      if (res.ok) {
        setMessages(res.data)
        setLastSync(new Date().toISOString())
      } else {
        setMessages([])
        pushToast(`Ordner konnte nicht geladen werden: ${res.error}`, 'error')
      }
    },
    [pushToast]
  )

  const openMessageIn = useCallback(
    async (accountId: string, mailbox: string, uid: number) => {
      setSelectedUid(uid)
      setLoadingDetail(true)
      setDetail(null)
      const res = await api.mail.message(accountId, mailbox, uid)
      setLoadingDetail(false)
      if (res.ok) {
        setDetail(res.data)
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)))
        api.mail.markSeen(accountId, mailbox, uid, true)
        loadMailboxes(accountId)
      } else {
        pushToast(`Nachricht konnte nicht geladen werden: ${res.error}`, 'error')
      }
    },
    [loadMailboxes, pushToast]
  )

  const openMessage = useCallback(
    (uid: number) => {
      if (!activeAccountId) return
      void openMessageIn(activeAccountId, mailboxRef.current, uid)
    },
    [activeAccountId, openMessageIn]
  )

  useEffect(() => {
    const off = api.update.on((evt) => {
      if (evt.state === 'available') {
        pushToast(`MailWave ${evt.info.version} ist verfügbar.`, 'info', {
          label: 'Jetzt aktualisieren',
          onClick: () => {
            pushToast('Update wird geladen … die App startet gleich neu.', 'info')
            void api.update.apply()
          }
        })
      } else if (evt.state === 'error') {
        pushToast(`Update-Prüfung fehlgeschlagen: ${evt.message}`, 'error')
      }
    })
    return off
  }, [pushToast])

  useEffect(() => {
    loadAccounts()
    const offStatus = api.onStatus((s) => {
      setStatuses((prev) => ({ ...prev, [s.accountId]: s.state }))
      setStatusMsg((prev) => ({ ...prev, [s.accountId]: s.message }))
    })
    const offMail = api.onNewMail((evt) => {
      if (evt.accountId.startsWith('temp:')) {
        setTempTick((n) => n + 1)
        if (!(evt as { focus?: boolean }).focus) {
          pushToast(`Neue E-Mail im Wegwerf-Postfach: ${evt.message.subject}`, 'info', {
            label: 'Öffnen',
            onClick: () => setView('temp')
          })
        }
        return
      }

      if (
        evt.accountId === activeAccountIdRef.current &&
        evt.mailbox === mailboxRef.current
      ) {
        setMessages((prev) =>
          prev.some((m) => m.uid === evt.message.uid) ? prev : [evt.message, ...prev]
        )
      }
      const accId = activeAccountIdRef.current
      if (accId) loadMailboxes(accId)
      const acc = accountsRef.current.find((a) => a.id === evt.accountId)

      if ((evt as { focus?: boolean }).focus) {
        setView('mail')
        setActiveAccountId(evt.accountId)
        setActiveMailbox(evt.mailbox)
        void openMessageIn(evt.accountId, evt.mailbox, evt.message.uid)
        return
      }
      pushToast(`Neue E-Mail · ${acc?.label ?? ''}: ${evt.message.subject}`, 'info', {
        label: 'Öffnen',
        onClick: () => {
          setView('mail')
          setActiveAccountId(evt.accountId)
          setActiveMailbox(evt.mailbox)
          void openMessageIn(evt.accountId, evt.mailbox, evt.message.uid)
        }
      })
    })
    return () => {
      offStatus()
      offMail()
    }
  }, [loadAccounts, loadMailboxes, openMessageIn, pushToast])

  useEffect(() => {
    if (!activeAccountId) return
    setSelectedUid(null)
    setDetail(null)
    setChecked(new Set())
    setActiveMailbox('INBOX')
    loadMailboxes(activeAccountId)
    loadMessages(activeAccountId, 'INBOX')
  }, [activeAccountId, loadMailboxes, loadMessages])

  const openMailbox = useCallback(
    (path: string) => {
      if (!activeAccountId) return
      setView('mail')
      setActiveMailbox(path)
      setSelectedUid(null)
      setDetail(null)
      setChecked(new Set())
      loadMessages(activeAccountId, path)
    },
    [activeAccountId, loadMessages]
  )

  const toggleFlag = useCallback(
    async (uid: number, value: boolean) => {
      if (!activeAccountId) return
      setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, flagged: value } : m)))
      setDetail((cur) => (cur?.uid === uid ? { ...cur, flagged: value } : cur))
      await api.mail.flag(activeAccountId, mailboxRef.current, uid, value)
    },
    [activeAccountId]
  )

  const deleteMessage = useCallback(
    async (uid: number) => {
      if (!activeAccountId) return
      const res = await api.mail.remove(activeAccountId, mailboxRef.current, uid)
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.uid !== uid))
        setSelectedUid((cur) => (cur === uid ? null : cur))
        setDetail((cur) => (cur?.uid === uid ? null : cur))
        loadMailboxes(activeAccountId)
      } else pushToast(`Löschen fehlgeschlagen: ${res.error}`, 'error')
    },
    [activeAccountId, loadMailboxes, pushToast]
  )

  const toggleCheck = useCallback((uid: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }, [])

  const bulkMarkSeen = useCallback(async () => {
    if (!activeAccountId) return
    const ids = [...checked]
    setMessages((prev) => prev.map((m) => (checked.has(m.uid) ? { ...m, seen: true } : m)))
    setChecked(new Set())
    await Promise.all(
      ids.map((uid) => api.mail.markSeen(activeAccountId, mailboxRef.current, uid, true))
    )
    loadMailboxes(activeAccountId)
  }, [activeAccountId, checked, loadMailboxes])

  const bulkDelete = useCallback(async () => {
    if (!activeAccountId) return
    const ids = [...checked]
    setMessages((prev) => prev.filter((m) => !checked.has(m.uid)))
    setChecked(new Set())
    setSelectedUid((cur) => (cur !== null && ids.includes(cur) ? null : cur))
    await Promise.all(
      ids.map((uid) => api.mail.remove(activeAccountId, mailboxRef.current, uid))
    )
    loadMailboxes(activeAccountId)
  }, [activeAccountId, checked, loadMailboxes])

  const saveAttachment = useCallback(
    async (index: number) => {
      if (!activeAccountId || selectedUid === null) return
      const res = await api.mail.saveAttachment(
        activeAccountId,
        mailboxRef.current,
        selectedUid,
        index
      )
      if (res.ok && res.data.saved) pushToast('Anhang gespeichert', 'success')
      else if (!res.ok) pushToast(`Speichern fehlgeschlagen: ${res.error}`, 'error')
    },
    [activeAccountId, selectedUid, pushToast]
  )

  const sync = useCallback(async () => {
    if (!activeAccountId) return
    await loadMailboxes(activeAccountId)
    await loadMessages(activeAccountId, mailboxRef.current)
  }, [activeAccountId, loadMailboxes, loadMessages])

  const handleSend = useCallback(
    async (payload: ComposePayload) => {
      const res = await api.mail.send(payload)
      if (res.ok) {
        setCompose(null)
        pushToast('E-Mail gesendet', 'success')
      } else {
        pushToast(`Senden fehlgeschlagen: ${res.error}`, 'error')
        throw new Error(res.error)
      }
    },
    [pushToast]
  )

  const saveAccount = useCallback(
    async (input: Parameters<typeof api.accounts.save>[0]) => {
      const res = await api.accounts.save(input)
      if (!res.ok) throw new Error(res.error)
      setAccountModal(null)
      await loadAccounts()
      setActiveAccountId(res.data.id)
      pushToast('Konto gespeichert', 'success')
    },
    [loadAccounts, pushToast]
  )

  const createDemoAccount = useCallback(async () => {
    const existing = accounts.find((a) => a.imap.host === 'demo')
    if (existing) {
      setActiveAccountId(existing.id)
      setView('mail')
      return
    }
    const res = await api.accounts.save({
      label: 'Demo',
      name: 'Demo-Nutzer',
      email: 'du@demo.mailwave.app',
      user: 'demo',
      password: 'demo',
      imap: { host: 'demo', port: 0, secure: false },
      smtp: { host: 'demo', port: 0, secure: false }
    })
    if (res.ok) {
      await loadAccounts()
      setActiveAccountId(res.data.id)
      setView('mail')
      pushToast('Demo-Postfach erstellt', 'success')
    } else pushToast(`Fehler: ${res.error}`, 'error')
  }, [accounts, loadAccounts, pushToast])

  const deleteAccount = useCallback(
    async (id: string) => {
      await api.accounts.delete(id)
      setAccountModal(null)
      setActiveAccountId((cur) => (cur === id ? null : cur))
      await loadAccounts()
    },
    [loadAccounts]
  )

  const replySeed = useCallback(
    (mode: 'reply' | 'replyAll' | 'forward'): void => {
      if (!detail || !activeAccount) return
      const quote = `\n\n---\nAm ${new Date(detail.date).toLocaleString('de-DE')} schrieb ${
        detail.fromName
      }:\n${(detail.text || '').replace(/^/gm, '> ')}`
      if (mode === 'forward') {
        setCompose({
          accountId: activeAccount.id,
          subject: `Fwd: ${detail.subject}`,
          body: quote
        })
        return
      }
      const cc =
        mode === 'replyAll'
          ? detail.to.filter((a) => a && a !== activeAccount.email).join(', ')
          : ''
      setCompose({
        accountId: activeAccount.id,
        to: detail.fromAddress,
        cc,
        subject: detail.subject.startsWith('Re:') ? detail.subject : `Re: ${detail.subject}`,
        body: quote
      })
    },
    [detail, activeAccount]
  )

  const filteredMessages = useMemo(() => {
    let list = messages
    if (listFilter === 'unread') list = list.filter((m) => !m.seen)
    else if (listFilter === 'flagged') list = list.filter((m) => m.flagged)
    else if (listFilter === 'attachments') list = list.filter((m) => m.hasAttachments)
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.fromName.toLowerCase().includes(q) ||
        m.fromAddress.toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q)
    )
  }, [messages, query, listFilter])

  const unreadByAccount = useMemo(() => {
    const map: Record<string, number> = {}
    if (activeAccountId) {
      const inbox = mailboxes.find((m) => m.specialUse === '\\Inbox' || m.path === 'INBOX')
      if (inbox) map[activeAccountId] = inbox.unseen
    }
    return map
  }, [activeAccountId, mailboxes])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        if (activeAccount) setCompose({ accountId: activeAccount.id })
        return
      }
      if (typing || compose || accountModal) return
      if (e.key === 'r' && detail) replySeed('reply')
      else if (e.key === 'e' && detail) replySeed('replyAll')
      else if (e.key === 'f' && detail) replySeed('forward')
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedUid !== null)
        void deleteMessage(selectedUid)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeAccount, compose, accountModal, detail, selectedUid, replySeed, deleteMessage])

  if (accounts.length === 0) {
    return (
      <div className="flex h-full w-full flex-col">
        <TitleBar />
        <div className="min-h-0 flex-1">
          <Onboarding
            onAdd={() => setAccountModal({})}
            onDemo={createDemoAccount}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </div>
        {accountModal && (
          <AccountModal
            account={accountModal.account}
            onClose={() => setAccountModal(null)}
            onSave={saveAccount}
            onTest={(i) => api.accounts.test(i)}
          />
        )}
      </div>
    )
  }

  const activeMailboxName =
    mailboxes.find((m) => m.path === activeMailbox)?.name ?? activeMailbox
  const state = activeAccountId ? statuses[activeAccountId] ?? 'connecting' : 'offline'
  const totalUnread = mailboxes.reduce((n, m) => n + m.unseen, 0)
  const context =
    view === 'temp'
      ? 'Wegwerf-Postfach'
      : view === 'settings'
        ? 'Einstellungen'
        : activeAccount
          ? `${activeAccount.label} — ${activeMailboxName}`
          : undefined

  return (
    <div className="flex h-full w-full flex-col bg-window text-ink">
      <TitleBar context={context} />

      <div className="relative flex min-h-0 flex-1">
        <AccountRail
          accounts={accounts}
          statuses={statuses}
          activeAccountId={activeAccountId}
          unreadByAccount={unreadByAccount}
          view={view}
          onSelect={(id) => {
            setView('mail')
            setActiveAccountId(id)
          }}
          onActiveClick={() => setAccountPopover((v) => !v)}
          onAdd={() => setAccountModal({})}
          onSettings={() => setView('settings')}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {accountPopover && (
          <AccountPopover
            accounts={accounts}
            statuses={statuses}
            activeAccountId={activeAccountId}
            unreadByAccount={unreadByAccount}
            onSelect={(id) => {
              setView('mail')
              setActiveAccountId(id)
            }}
            onAdd={() => setAccountModal({})}
            onManage={() => setView('settings')}
            onClose={() => setAccountPopover(false)}
          />
        )}

        <Sidebar
          mailboxes={mailboxes}
          activeMailbox={activeMailbox}
          view={view}
          onSelectMailbox={openMailbox}
          onOpenTemp={() => setView('temp')}
          onCompose={() => activeAccount && setCompose({ accountId: activeAccount.id })}
          onOpenPalette={() => pushToast('Command-Palette folgt in Kürze.', 'info')}
        />

        {view === 'temp' ? (
          <TempMailView
            density={density}
            newMailTick={tempTick}
            onToast={(text, tone) => pushToast(text, tone)}
            onOpenExternal={(url) => api.openExternal(url)}
          />
        ) : view === 'settings' ? (
          <SettingsPlaceholder
            accounts={accounts}
            onEdit={(a) => setAccountModal({ account: a })}
            onAdd={() => setAccountModal({})}
            onDemo={createDemoAccount}
            onClose={() => setView('mail')}
          />
        ) : (
          <div className="flex min-h-0 flex-1">
            <MessageList
              messages={filteredMessages}
              loading={loadingList}
              selectedUid={selectedUid}
              query={query}
              filter={listFilter}
              accountName={activeAccount?.label}
              checked={checked}
              selectMode={selectMode}
              onQuery={setQuery}
              onFilter={setListFilter}
              onSync={sync}
              onToggleSelectMode={() => {
                setSelectMode((v) => !v)
                setChecked(new Set())
              }}
              onSelect={openMessage}
              onToggleCheck={toggleCheck}
              onClearChecked={() => setChecked(new Set())}
              onBulkMarkSeen={bulkMarkSeen}
              onBulkDelete={bulkDelete}
              onToggleFlag={toggleFlag}
              onDelete={deleteMessage}
            />
            <MessageView
              detail={detail}
              loading={loadingDetail}
              hasSelection={selectedUid !== null}
              theme={theme}
              onReply={() => replySeed('reply')}
              onReplyAll={() => replySeed('replyAll')}
              onForward={() => replySeed('forward')}
              onDelete={() => selectedUid !== null && deleteMessage(selectedUid)}
              onToggleFlag={(v) => selectedUid !== null && toggleFlag(selectedUid, v)}
              onOpenExternal={(url) => api.openExternal(url)}
              onSaveAttachment={saveAttachment}
            />
          </div>
        )}
      </div>

      <StatusBar
        state={state}
        message={activeAccountId ? statusMsg[activeAccountId] : undefined}
        server={
          activeAccount && activeAccount.imap.host !== 'demo'
            ? `${activeAccount.imap.host}:${activeAccount.imap.port}`
            : undefined
        }
        lastSync={lastSync}
        unread={totalUnread}
        accountCount={accounts.length}
        onReconnect={() => activeAccountId && api.mail.sync(activeAccountId)}
        onCommand={() => pushToast('Command-Palette folgt in Kürze.', 'info')}
      />

      <Toasts toasts={toasts} onClose={dismissToast} />

      {compose && activeAccount && (
        <ComposeModal
          seed={compose}
          accounts={accounts}
          onClose={() => setCompose(null)}
          onSend={handleSend}
        />
      )}

      {accountModal && (
        <AccountModal
          account={accountModal.account}
          onClose={() => setAccountModal(null)}
          onSave={saveAccount}
          onDelete={accountModal.account ? deleteAccount : undefined}
          onTest={(i) => api.accounts.test(i)}
        />
      )}
    </div>
  )
}

/** Schlichte Einstellungen-Ansicht bis der vollständige Screen 09 folgt. */
function SettingsPlaceholder(props: {
  accounts: MailAccount[]
  onEdit: (a: MailAccount) => void
  onAdd: () => void
  onDemo: () => void
  onClose: () => void
}): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-window">
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line px-6">
        <h1 className="font-display text-lg font-semibold text-ink">Einstellungen</h1>
        <button
          onClick={props.onClose}
          className="ml-auto text-sm text-ink-soft transition hover:text-ink"
        >
          Fertig
        </button>
      </div>
      <div className="mx-auto w-full max-w-[640px] flex-1 overflow-y-auto px-7 py-6">
        <p className="mb-2 text-2xs font-medium uppercase tracking-[0.09em] text-ink-mute">Konten</p>
        <div className="space-y-2">
          {props.accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-panel p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{a.label}</div>
                <div className="truncate font-mono text-xs text-ink-mute">{a.email}</div>
              </div>
              <button
                onClick={() => props.onEdit(a)}
                className="rounded-[3px] border border-line-control px-3 py-1.5 text-xs text-ink transition hover:border-line-hover"
              >
                Bearbeiten
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={props.onAdd}
            className="rounded-[3px] border border-line-control px-3 py-1.5 text-xs text-ink transition hover:border-line-hover"
          >
            Konto hinzufügen
          </button>
          <button
            onClick={props.onDemo}
            className="rounded-[3px] px-3 py-1.5 text-xs text-ink-soft transition hover:text-ink"
          >
            Demo-Postfach
          </button>
        </div>
      </div>
    </div>
  )
}
