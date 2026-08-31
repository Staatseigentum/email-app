import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ComposePayload,
  ConnectionStatus,
  MailAccount,
  MailboxNode,
  MessageDetail,
  MessageSummary
} from '../../shared/types'
import { Sidebar } from './components/Sidebar'
import { MessageList, type Density } from './components/MessageList'
import { MessageView } from './components/MessageView'
import { ComposeModal, type ComposeSeed } from './components/ComposeModal'
import { AccountModal } from './components/AccountModal'
import { Onboarding } from './components/Onboarding'
import { TopBar } from './components/TopBar'
import { TempMailView } from './components/TempMailView'
import { Toasts, type Toast, type ToastTone } from './components/Toasts'

const api = window.mailwave

let toastSeq = 0

export default function App(): JSX.Element {
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus['state']>>({})
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [mailboxes, setMailboxes] = useState<MailboxNode[]>([])
  const [activeMailbox, setActiveMailbox] = useState('INBOX')
  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [detail, setDetail] = useState<MessageDetail | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [query, setQuery] = useState('')
  const [compose, setCompose] = useState<ComposeSeed | null>(null)
  const [accountModal, setAccountModal] = useState<{ account?: MailAccount } | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [view, setView] = useState<'mail' | 'temp'>('mail')
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [tempTick, setTempTick] = useState(0)
  const [density, setDensity] = useState<Density>(
    (localStorage.getItem('density') as Density) || 'cozy'
  )
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

  useEffect(() => {
    localStorage.setItem('density', density)
  }, [density])

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
      if (res.ok) setMessages(res.data)
      else {
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
    const offStatus = api.onStatus((s) =>
      setStatuses((prev) => ({ ...prev, [s.accountId]: s.state }))
    )
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

  const markAllSeen = useCallback(async () => {
    if (!activeAccountId) return
    setMessages((prev) => prev.map((m) => ({ ...m, seen: true })))
    const res = await api.mail.markAllSeen(activeAccountId, mailboxRef.current)
    if (res.ok) {
      loadMailboxes(activeAccountId)
      pushToast('Alle als gelesen markiert', 'success')
    } else pushToast(`Fehlgeschlagen: ${res.error}`, 'error')
  }, [activeAccountId, loadMailboxes, pushToast])

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
    pushToast('Aktualisiert', 'info')
  }, [activeAccountId, loadMailboxes, loadMessages, pushToast])

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

  const filteredMessages = useMemo(() => {
    if (!query.trim()) return messages
    const q = query.toLowerCase()
    return messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.fromName.toLowerCase().includes(q) ||
        m.fromAddress.toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q)
    )
  }, [messages, query])

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

  if (accounts.length === 0) {
    return (
      <>
        <Onboarding
          onAdd={() => setAccountModal({})}
          onDemo={createDemoAccount}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {accountModal && (
          <AccountModal
            account={accountModal.account}
            onClose={() => setAccountModal(null)}
            onSave={saveAccount}
            onTest={(i) => api.accounts.test(i)}
          />
        )}
      </>
    )
  }

  const activeMailboxName =
    mailboxes.find((m) => m.path === activeMailbox)?.name ?? activeMailbox
  const unreadHere = messages.some((m) => !m.seen)

  return (
    <div className="app-bg flex h-full w-full text-slate-900 dark:text-slate-100">
      <Sidebar
        accounts={accounts}
        statuses={statuses}
        activeAccountId={activeAccountId}
        onSelectAccount={(id) => {
          setView('mail')
          setActiveAccountId(id)
        }}
        mailboxes={mailboxes}
        activeMailbox={activeMailbox}
        view={view}
        onSelectMailbox={openMailbox}
        onOpenTemp={() => setView('temp')}
        onCompose={() => activeAccount && setCompose({ accountId: activeAccount.id })}
        onAddAccount={() => setAccountModal({})}
        onDemo={createDemoAccount}
        onEditAccount={(a) => setAccountModal({ account: a })}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={view === 'temp' ? 'Wegwerf-Postfach' : activeMailboxName}
          subtitle={view === 'temp' ? undefined : activeAccount?.email}
          query={query}
          onQuery={setQuery}
          onMarkAllSeen={view === 'temp' ? undefined : markAllSeen}
          canMarkAllSeen={unreadHere}
          onSync={sync}
          density={density}
          onToggleDensity={() => setDensity((d) => (d === 'cozy' ? 'compact' : 'cozy'))}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {view === 'temp' ? (
          <TempMailView
            density={density}
            newMailTick={tempTick}
            onToast={(text, tone) => pushToast(text, tone)}
            onOpenExternal={(url) => api.openExternal(url)}
          />
        ) : (
          <div className="flex min-h-0 flex-1">
            <MessageList
              messages={filteredMessages}
              loading={loadingList}
              selectedUid={selectedUid}
              density={density}
              checked={checked}
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
              onReply={() => replySeed('reply')}
              onReplyAll={() => replySeed('replyAll')}
              onForward={() => replySeed('forward')}
              onDelete={() => selectedUid !== null && deleteMessage(selectedUid)}
              onOpenExternal={(url) => api.openExternal(url)}
              onSaveAttachment={saveAttachment}
            />
          </div>
        )}
      </div>

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
