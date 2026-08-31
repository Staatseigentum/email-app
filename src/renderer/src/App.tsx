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
import { MessageList } from './components/MessageList'
import { MessageView } from './components/MessageView'
import { ComposeModal, type ComposeSeed } from './components/ComposeModal'
import { AccountModal } from './components/AccountModal'
import { Onboarding } from './components/Onboarding'
import { IconRefresh, IconSearch } from './components/Icons'

const api = window.mailwave

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
  const [toast, setToast] = useState<string | null>(null)
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

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

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
        showToast(`Ordner konnte nicht geladen werden: ${res.error}`)
      }
    },
    [showToast]
  )

  useEffect(() => {
    loadAccounts()
    const offStatus = api.onStatus((s) =>
      setStatuses((prev) => ({ ...prev, [s.accountId]: s.state }))
    )
    const offMail = api.onNewMail((evt) => {
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
      showToast(`Neue E-Mail · ${acc?.label ?? ''}: ${evt.message.subject}`)
    })
    return () => {
      offStatus()
      offMail()
    }
  }, [loadAccounts, loadMailboxes, showToast])

  useEffect(() => {
    if (!activeAccountId) return
    setSelectedUid(null)
    setDetail(null)
    setActiveMailbox('INBOX')
    loadMailboxes(activeAccountId)
    loadMessages(activeAccountId, 'INBOX')
  }, [activeAccountId, loadMailboxes, loadMessages])

  const openMailbox = useCallback(
    (path: string) => {
      if (!activeAccountId) return
      setActiveMailbox(path)
      setSelectedUid(null)
      setDetail(null)
      loadMessages(activeAccountId, path)
    },
    [activeAccountId, loadMessages]
  )

  const openMessage = useCallback(
    async (uid: number) => {
      if (!activeAccountId) return
      const mailbox = mailboxRef.current
      setSelectedUid(uid)
      setLoadingDetail(true)
      setDetail(null)
      const res = await api.mail.message(activeAccountId, mailbox, uid)
      setLoadingDetail(false)
      if (res.ok) {
        setDetail(res.data)
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)))
        api.mail.markSeen(activeAccountId, mailbox, uid, true)
        loadMailboxes(activeAccountId)
      } else {
        showToast(`Nachricht konnte nicht geladen werden: ${res.error}`)
      }
    },
    [activeAccountId, loadMailboxes, showToast]
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
      } else showToast(`Löschen fehlgeschlagen: ${res.error}`)
    },
    [activeAccountId, loadMailboxes, showToast]
  )

  const sync = useCallback(async () => {
    if (!activeAccountId) return
    await loadMailboxes(activeAccountId)
    await loadMessages(activeAccountId, mailboxRef.current)
    showToast('Aktualisiert')
  }, [activeAccountId, loadMailboxes, loadMessages, showToast])

  const handleSend = useCallback(
    async (payload: ComposePayload) => {
      const res = await api.mail.send(payload)
      if (res.ok) {
        setCompose(null)
        showToast('E-Mail gesendet')
      } else {
        showToast(`Senden fehlgeschlagen: ${res.error}`)
        throw new Error(res.error)
      }
    },
    [showToast]
  )

  const saveAccount = useCallback(
    async (input: Parameters<typeof api.accounts.save>[0]) => {
      const res = await api.accounts.save(input)
      if (!res.ok) throw new Error(res.error)
      setAccountModal(null)
      await loadAccounts()
      setActiveAccountId(res.data.id)
      showToast('Konto gespeichert')
    },
    [loadAccounts, showToast]
  )

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
        <Onboarding onAdd={() => setAccountModal({})} theme={theme} onToggleTheme={toggleTheme} />
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

  return (
    <div className="flex h-full w-full bg-slate-100 text-slate-900 dark:bg-[#0b0f1a] dark:text-slate-100">
      <Sidebar
        accounts={accounts}
        statuses={statuses}
        activeAccountId={activeAccountId}
        onSelectAccount={setActiveAccountId}
        mailboxes={mailboxes}
        activeMailbox={activeMailbox}
        onSelectMailbox={openMailbox}
        onCompose={() => activeAccount && setCompose({ accountId: activeAccount.id })}
        onAddAccount={() => setAccountModal({})}
        onEditAccount={(a) => setAccountModal({ account: a })}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="drag flex h-14 items-center gap-3 border-b border-slate-200 px-5 dark:border-white/10">
          <h1 className="text-sm font-semibold capitalize text-slate-500 dark:text-slate-400">
            {activeMailboxName}
          </h1>
          <div className="no-drag relative ml-auto w-72">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen…"
              className="w-full rounded-lg border border-slate-200 bg-white/70 py-1.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <button
            onClick={sync}
            className="no-drag rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
            title="Aktualisieren"
          >
            <IconRefresh />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <MessageList
            messages={filteredMessages}
            loading={loadingList}
            selectedUid={selectedUid}
            onSelect={openMessage}
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
          />
        </div>
      </div>

      {toast && (
        <div className="animate-fade-in fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl dark:bg-white dark:text-slate-900">
          {toast}
        </div>
      )}

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
