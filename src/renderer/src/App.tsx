import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppSettings,
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
import { Settings } from './components/Settings'
import { Onboarding } from './components/Onboarding'
import { TitleBar } from './components/TitleBar'
import { StatusBar } from './components/StatusBar'
import { TempMailView } from './components/TempMailView'
import { Toasts, type Toast, type ToastTone } from './components/Toasts'
import { CommandPalette, type Command } from './components/CommandPalette'
import { ShortcutSheet } from './components/ShortcutSheet'

const api = window.mailwave
const PAGE_SIZE = 50

let toastSeq = 0

type View = 'mail' | 'temp' | 'settings' | 'unified'

const DEFAULT_SETTINGS: AppSettings = {
  undoSendSeconds: 5,
  blockRemoteContent: true,
  notify: 'all',
  signatures: {},
  remoteAllow: []
}

export default function App(): JSX.Element {
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus['state']>>({})
  const [statusMsg, setStatusMsg] = useState<Record<string, string | undefined>>({})
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [mailboxes, setMailboxes] = useState<MailboxNode[]>([])
  const [activeMailbox, setActiveMailbox] = useState('INBOX')
  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [unifiedMessages, setUnifiedMessages] = useState<MessageSummary[]>([])
  const [searchResults, setSearchResults] = useState<MessageSummary[] | null>(null)
  const [searchScope, setSearchScope] = useState<'mailbox' | 'all'>('mailbox')
  const [searching, setSearching] = useState(false)
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [detail, setDetail] = useState<MessageDetail | null>(null)
  const [detailCtx, setDetailCtx] = useState<{ accountId: string; mailbox: string } | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [query, setQuery] = useState('')
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [selectMode, setSelectMode] = useState(false)
  const [compose, setCompose] = useState<ComposeSeed | null>(null)
  const [accountModal, setAccountModal] = useState<{ account?: MailAccount } | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [view, setView] = useState<View>('mail')
  const [accountPopover, setAccountPopover] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [tempTick, setTempTick] = useState(0)
  const [lastSync, setLastSync] = useState<string | undefined>()
  const [density, setDensity] = useState<Density>(
    (localStorage.getItem('density') as Density) || 'cozy'
  )
  const [threaded, setThreaded] = useState<boolean>(localStorage.getItem('threaded') === '1')
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [appVersion, setAppVersion] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  )

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null

  const listReqId = useRef(0)
  const pageRef = useRef(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const goChord = useRef(false)
  const undoRef = useRef<{ timer: number; toastId: string; payload: ComposePayload } | null>(null)
  const activeAccountIdRef = useRef<string | null>(null)
  const mailboxRef = useRef('INBOX')
  const accountsRef = useRef<MailAccount[]>([])
  const messagesRef = useRef<MessageSummary[]>([])
  const viewRef = useRef<View>('mail')
  activeAccountIdRef.current = activeAccountId
  mailboxRef.current = activeMailbox
  accountsRef.current = accounts
  messagesRef.current = messages
  viewRef.current = view

  const listMode: 'folder' | 'unified' | 'search' =
    view === 'unified' ? 'unified' : searchResults ? 'search' : 'folder'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('density', density)
  }, [density])

  useEffect(() => {
    localStorage.setItem('threaded', threaded ? '1' : '0')
  }, [threaded])

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    []
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback(
    (text: string, tone: ToastTone = 'info', action?: Toast['action'], sticky?: boolean): string => {
      const id = `t${++toastSeq}`
      setToasts((prev) => [...prev.slice(-3), { id, text, tone, action, sticky }])
      return id
    },
    []
  )

  const loadSettings = useCallback(async () => {
    const res = await api.settings.get()
    if (res.ok) setSettings(res.data)
  }, [])

  const saveSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...patch,
      signatures: patch.signatures
        ? { ...prev.signatures, ...patch.signatures }
        : prev.signatures
    }))
    const res = await api.settings.set(patch)
    if (res.ok) setSettings(res.data)
  }, [])

  // Signatur-Block für ein Konto (führende Leerzeilen inklusive).
  const sigBlock = useCallback(
    (accountId: string): string => {
      const s = (settings.signatures[accountId] ?? '').trimEnd()
      return s ? `\n\n${s}` : ''
    },
    [settings.signatures]
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
      pageRef.current = 0
      setHasMore(true)
      setLoadingList(true)
      const res = await api.mail.messages(accountId, mailbox, 0)
      if (reqId !== listReqId.current) return
      setLoadingList(false)
      if (res.ok) {
        setMessages(res.data)
        if (res.data.length < PAGE_SIZE) setHasMore(false)
        setLastSync(new Date().toISOString())
      } else {
        setMessages([])
        pushToast(`Ordner konnte nicht geladen werden: ${res.error}`, 'error')
      }
    },
    [pushToast]
  )

  const loadMore = useCallback(async () => {
    if (!activeAccountIdRef.current || loadingMore || !hasMore) return
    setLoadingMore(true)
    const next = pageRef.current + 1
    const res = await api.mail.messages(activeAccountIdRef.current, mailboxRef.current, next)
    setLoadingMore(false)
    if (!res.ok) {
      setHasMore(false)
      return
    }
    const existing = new Set(messagesRef.current.map((m) => m.uid))
    const fresh = res.data.filter((m) => !existing.has(m.uid))
    if (fresh.length === 0 || res.data.length < PAGE_SIZE) setHasMore(false)
    if (fresh.length > 0) {
      pageRef.current = next
      setMessages((prev) => [...prev, ...fresh])
    }
  }, [loadingMore, hasMore])

  const loadUnified = useCallback(async () => {
    setLoadingList(true)
    const res = await api.mail.unified()
    setLoadingList(false)
    if (res.ok) setUnifiedMessages(res.data)
    else pushToast(`Gemeinsamer Posteingang: ${res.error}`, 'error')
  }, [pushToast])

  const applyPatch = useCallback(
    (accountId: string, uid: number, patch: Partial<MessageSummary>) => {
      const upd = (arr: MessageSummary[]): MessageSummary[] =>
        arr.map((m) =>
          m.uid === uid && (!m.accountId || m.accountId === accountId) ? { ...m, ...patch } : m
        )
      setMessages(upd)
      setUnifiedMessages(upd)
      setSearchResults((r) => (r ? upd(r) : r))
      setDetail((d) => (d && d.uid === uid ? { ...d, ...patch } : d))
    },
    []
  )

  const removeMsg = useCallback((accountId: string, uid: number) => {
    const rm = (arr: MessageSummary[]): MessageSummary[] =>
      arr.filter((m) => !(m.uid === uid && (!m.accountId || m.accountId === accountId)))
    setMessages(rm)
    setUnifiedMessages(rm)
    setSearchResults((r) => (r ? rm(r) : r))
    setSelectedUid((cur) => (cur === uid ? null : cur))
    setDetail((d) => (d && d.uid === uid ? null : d))
  }, [])

  const shown = useMemo(() => {
    if (listMode === 'search') return searchResults ?? []
    if (listMode === 'unified') return unifiedMessages
    return messages
  }, [listMode, searchResults, unifiedMessages, messages])

  const ctxFor = useCallback(
    (uid: number): { accountId: string; mailbox: string } => {
      if (listMode === 'folder') {
        return { accountId: activeAccountIdRef.current ?? '', mailbox: mailboxRef.current }
      }
      const m = shown.find((x) => x.uid === uid)
      return {
        accountId: m?.accountId ?? activeAccountIdRef.current ?? '',
        mailbox: m?.mailbox ?? 'INBOX'
      }
    },
    [listMode, shown]
  )

  const openMessageIn = useCallback(
    async (accountId: string, mailbox: string, uid: number) => {
      setSelectedUid(uid)
      setDetailCtx({ accountId, mailbox })
      setLoadingDetail(true)
      setDetail(null)
      const res = await api.mail.message(accountId, mailbox, uid)
      setLoadingDetail(false)
      if (res.ok) {
        setDetail(res.data)
        applyPatch(accountId, uid, { seen: true })
        api.mail.markSeen(accountId, mailbox, uid, true)
        loadMailboxes(accountId)
      } else {
        pushToast(`Nachricht konnte nicht geladen werden: ${res.error}`, 'error')
      }
    },
    [applyPatch, loadMailboxes, pushToast]
  )

  const openDraft = useCallback(
    async (accountId: string, mailbox: string, uid: number) => {
      setSelectedUid(uid)
      const res = await api.mail.message(accountId, mailbox, uid)
      if (!res.ok) {
        pushToast(`Entwurf konnte nicht geladen werden: ${res.error}`, 'error')
        return
      }
      const d = res.data
      setCompose({
        accountId,
        to: d.to.join(', '),
        cc: d.cc.join(', '),
        subject: d.subject === '(kein Betreff)' ? '' : d.subject,
        body: d.text ?? '',
        draftUid: uid
      })
    },
    [pushToast]
  )

  const openMessage = useCallback(
    (uid: number) => {
      const ctx = ctxFor(uid)
      if (!ctx.accountId) return
      const box = mailboxes.find((m) => m.path === ctx.mailbox)
      if (box?.specialUse === '\\Drafts') {
        void openDraft(ctx.accountId, ctx.mailbox, uid)
        return
      }
      void openMessageIn(ctx.accountId, ctx.mailbox, uid)
    },
    [ctxFor, mailboxes, openDraft, openMessageIn]
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
      } else if (evt.state === 'none') {
        pushToast('MailWave ist aktuell.', 'success')
      }
    })
    return off
  }, [pushToast])

  useEffect(() => {
    loadAccounts()
    loadSettings()
    api.appVersion().then((r) => r.ok && setAppVersion(r.data))
    const offStatus = api.onStatus((s) => {
      setStatuses((prev) => ({ ...prev, [s.accountId]: s.state }))
      setStatusMsg((prev) => ({ ...prev, [s.accountId]: s.message }))
    })
    const offMail = api.onNewMail((evt) => {
      if (evt.accountId.startsWith('temp:')) {
        setTempTick((n) => n + 1)
        if (!evt.focus) {
          pushToast(`Neue E-Mail im Wegwerf-Postfach: ${evt.message.subject}`, 'info', {
            label: 'Öffnen',
            onClick: () => setView('temp')
          })
        }
        return
      }

      if (
        evt.accountId === activeAccountIdRef.current &&
        evt.mailbox === mailboxRef.current &&
        viewRef.current === 'mail'
      ) {
        setMessages((prev) =>
          prev.some((m) => m.uid === evt.message.uid) ? prev : [evt.message, ...prev]
        )
      }
      if (viewRef.current === 'unified') void loadUnified()
      const accId = activeAccountIdRef.current
      if (accId) loadMailboxes(accId)
      const acc = accountsRef.current.find((a) => a.id === evt.accountId)

      if (evt.focus) {
        setView('mail')
        setActiveAccountId(evt.accountId)
        setActiveMailbox(evt.mailbox)
        if (evt.reply) {
          setCompose({
            accountId: evt.accountId,
            to: evt.message.fromAddress,
            subject: evt.message.subject.startsWith('Re:')
              ? evt.message.subject
              : `Re: ${evt.message.subject}`,
            body: sigBlock(evt.accountId)
          })
        } else {
          void openMessageIn(evt.accountId, evt.mailbox, evt.message.uid)
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAccounts, loadSettings, loadMailboxes, loadUnified, openMessageIn, pushToast])

  useEffect(() => {
    if (!activeAccountId) return
    setSelectedUid(null)
    setDetail(null)
    setChecked(new Set())
    setSearchResults(null)
    setActiveMailbox('INBOX')
    loadMailboxes(activeAccountId)
    loadMessages(activeAccountId, 'INBOX')
  }, [activeAccountId, loadMailboxes, loadMessages])

  useEffect(() => {
    if (view === 'unified') {
      setSelectedUid(null)
      setDetail(null)
      setSearchResults(null)
      void loadUnified()
    }
  }, [view, loadUnified])

  const openMailbox = useCallback(
    (path: string) => {
      if (!activeAccountId) return
      setView('mail')
      setActiveMailbox(path)
      setSelectedUid(null)
      setDetail(null)
      setChecked(new Set())
      setSearchResults(null)
      setQuery('')
      loadMessages(activeAccountId, path)
    },
    [activeAccountId, loadMessages]
  )

  const runSearch = useCallback(
    async (scope: 'mailbox' | 'all') => {
      const q = query.trim()
      if (!q || !activeAccountId) return
      setSearchScope(scope)
      setSearching(true)
      const res = await api.mail.search({
        accountId: activeAccountId,
        text: q,
        scope,
        mailbox: mailboxRef.current
      })
      setSearching(false)
      if (res.ok) setSearchResults(res.data)
      else pushToast(`Suche fehlgeschlagen: ${res.error}`, 'error')
    },
    [query, activeAccountId, pushToast]
  )

  const exitSearch = useCallback(() => {
    setSearchResults(null)
    setQuery('')
  }, [])

  const toggleFlag = useCallback(
    async (uid: number, value: boolean) => {
      const ctx = ctxFor(uid)
      if (!ctx.accountId) return
      applyPatch(ctx.accountId, uid, { flagged: value })
      await api.mail.flag(ctx.accountId, ctx.mailbox, uid, value)
    },
    [ctxFor, applyPatch]
  )

  const toggleSeen = useCallback(
    async (uid: number, value: boolean) => {
      const ctx = ctxFor(uid)
      if (!ctx.accountId) return
      applyPatch(ctx.accountId, uid, { seen: value })
      await api.mail.markSeen(ctx.accountId, ctx.mailbox, uid, value)
      loadMailboxes(ctx.accountId)
    },
    [ctxFor, applyPatch, loadMailboxes]
  )

  const deleteMessage = useCallback(
    async (uid: number) => {
      const ctx = ctxFor(uid)
      if (!ctx.accountId) return
      removeMsg(ctx.accountId, uid)
      const res = await api.mail.remove(ctx.accountId, ctx.mailbox, uid)
      if (!res.ok) pushToast(`Löschen fehlgeschlagen: ${res.error}`, 'error')
      else loadMailboxes(ctx.accountId)
    },
    [ctxFor, removeMsg, loadMailboxes, pushToast]
  )

  const moveMessage = useCallback(
    async (uid: number, target: string, targetLabel: string) => {
      const ctx = ctxFor(uid)
      if (!ctx.accountId || ctx.mailbox === target) return
      removeMsg(ctx.accountId, uid)
      const res = await api.mail.move(ctx.accountId, ctx.mailbox, uid, target)
      if (!res.ok) {
        pushToast(`Verschieben fehlgeschlagen: ${res.error}`, 'error')
        void (listMode === 'unified' ? loadUnified() : loadMessages(ctx.accountId, ctx.mailbox))
      } else {
        pushToast(`Nach „${targetLabel}" verschoben`, 'success')
        loadMailboxes(ctx.accountId)
      }
    },
    [ctxFor, removeMsg, loadMailboxes, loadMessages, loadUnified, listMode, pushToast]
  )

  const archive = useCallback(
    (uid: number) => void moveMessage(uid, '\\Archive', 'Archiv'),
    [moveMessage]
  )

  const markAllSeen = useCallback(async () => {
    if (!activeAccountId) return
    setMessages((prev) => prev.map((m) => ({ ...m, seen: true })))
    setDetail((cur) => (cur ? { ...cur, seen: true } : cur))
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
    const ids = [...checked]
    const ctxs = ids.map((uid) => ({ uid, ...ctxFor(uid) }))
    setMessages((prev) => prev.map((m) => (checked.has(m.uid) ? { ...m, seen: true } : m)))
    setUnifiedMessages((prev) => prev.map((m) => (checked.has(m.uid) ? { ...m, seen: true } : m)))
    setChecked(new Set())
    await Promise.all(
      ctxs.map((c) => api.mail.markSeen(c.accountId, c.mailbox, c.uid, true))
    )
    if (activeAccountIdRef.current) loadMailboxes(activeAccountIdRef.current)
  }, [checked, ctxFor, loadMailboxes])

  const bulkDelete = useCallback(async () => {
    const ids = [...checked]
    const ctxs = ids.map((uid) => ({ uid, ...ctxFor(uid) }))
    setMessages((prev) => prev.filter((m) => !checked.has(m.uid)))
    setUnifiedMessages((prev) => prev.filter((m) => !checked.has(m.uid)))
    setChecked(new Set())
    setSelectedUid((cur) => (cur !== null && ids.includes(cur) ? null : cur))
    await Promise.all(ctxs.map((c) => api.mail.remove(c.accountId, c.mailbox, c.uid)))
    if (activeAccountIdRef.current) loadMailboxes(activeAccountIdRef.current)
  }, [checked, ctxFor, loadMailboxes])

  const bulkArchive = useCallback(async () => {
    const ids = [...checked]
    const ctxs = ids.map((uid) => ({ uid, ...ctxFor(uid) }))
    setMessages((prev) => prev.filter((m) => !checked.has(m.uid)))
    setUnifiedMessages((prev) => prev.filter((m) => !checked.has(m.uid)))
    setChecked(new Set())
    await Promise.all(
      ctxs.map((c) => api.mail.move(c.accountId, c.mailbox, c.uid, '\\Archive'))
    )
    if (activeAccountIdRef.current) loadMailboxes(activeAccountIdRef.current)
    pushToast(`${ids.length} archiviert`, 'success')
  }, [checked, ctxFor, loadMailboxes, pushToast])

  const saveAttachment = useCallback(
    async (index: number) => {
      if (selectedUid === null || !detailCtx) return
      const res = await api.mail.saveAttachment(
        detailCtx.accountId,
        detailCtx.mailbox,
        selectedUid,
        index
      )
      if (res.ok && res.data.saved) pushToast('Anhang gespeichert', 'success')
      else if (!res.ok) pushToast(`Speichern fehlgeschlagen: ${res.error}`, 'error')
    },
    [selectedUid, detailCtx, pushToast]
  )

  const previewAttachment = useCallback(
    async (index: number) => {
      if (selectedUid === null || !detailCtx) throw new Error('Keine Auswahl')
      const res = await api.mail.attachmentData(
        detailCtx.accountId,
        detailCtx.mailbox,
        selectedUid,
        index
      )
      if (!res.ok) {
        pushToast(`Vorschau fehlgeschlagen: ${res.error}`, 'error')
        throw new Error(res.error)
      }
      return res.data
    },
    [selectedUid, detailCtx, pushToast]
  )

  const sync = useCallback(async () => {
    if (view === 'unified') {
      await loadUnified()
      return
    }
    if (searchResults) {
      await runSearch(searchScope)
      return
    }
    if (!activeAccountId) return
    await loadMailboxes(activeAccountId)
    await loadMessages(activeAccountId, mailboxRef.current)
  }, [
    view,
    searchResults,
    searchScope,
    runSearch,
    activeAccountId,
    loadMailboxes,
    loadMessages,
    loadUnified
  ])

  const draftsPath = useMemo(
    () => mailboxes.find((m) => m.specialUse === '\\Drafts')?.path,
    [mailboxes]
  )

  const handleSaveDraft = useCallback(
    async (payload: Parameters<typeof api.mail.saveDraft>[0]) => {
      const res = await api.mail.saveDraft(payload)
      if (!res.ok) return null
      if (draftsPath) loadMailboxes(payload.accountId)
      return res.data
    },
    [draftsPath, loadMailboxes]
  )

  const doSend = useCallback(
    async (payload: ComposePayload): Promise<void> => {
      const res = await api.mail.send(payload)
      if (res.ok) pushToast('E-Mail gesendet', 'success')
      else pushToast(`Senden fehlgeschlagen: ${res.error}`, 'error')
      if (activeAccountIdRef.current) loadMailboxes(activeAccountIdRef.current)
    },
    [loadMailboxes, pushToast]
  )

  const handleSend = useCallback(
    async (payload: ComposePayload) => {
      const secs = settings.undoSendSeconds
      if (secs > 0) {
        setCompose(null)
        const toastId = pushToast(
          `Wird in ${secs} s gesendet …`,
          'info',
          {
            label: 'Rückgängig',
            onClick: () => {
              if (undoRef.current) {
                clearTimeout(undoRef.current.timer)
                undoRef.current = null
              }
              setCompose({
                accountId: payload.accountId,
                to: payload.to,
                cc: payload.cc,
                bcc: payload.bcc,
                subject: payload.subject,
                body: payload.text,
                inReplyTo: payload.inReplyTo,
                references: payload.references,
                attachments: payload.attachments
              })
            }
          },
          true
        )
        const timer = window.setTimeout(() => {
          dismissToast(toastId)
          undoRef.current = null
          void doSend(payload)
        }, secs * 1000)
        undoRef.current = { timer, toastId, payload }
        return
      }
      const res = await api.mail.send(payload)
      if (res.ok) {
        setCompose(null)
        pushToast('E-Mail gesendet', 'success')
        if (activeAccountIdRef.current) loadMailboxes(activeAccountIdRef.current)
      } else {
        pushToast(`Senden fehlgeschlagen: ${res.error}`, 'error')
        throw new Error(res.error)
      }
    },
    [settings.undoSendSeconds, pushToast, dismissToast, doSend, loadMailboxes]
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

  const composeNew = useCallback(() => {
    if (!activeAccount) return
    setCompose({ accountId: activeAccount.id, body: sigBlock(activeAccount.id) })
  }, [activeAccount, sigBlock])

  const replySeed = useCallback(
    (mode: 'reply' | 'replyAll' | 'forward'): void => {
      const acctId = detailCtx?.accountId ?? activeAccount?.id
      if (!detail || !acctId) return
      const acc = accounts.find((a) => a.id === acctId)
      const quote = `\n\n---\nAm ${new Date(detail.date).toLocaleString('de-DE')} schrieb ${
        detail.fromName
      }:\n${(detail.text || '').replace(/^/gm, '> ')}`
      const sig = sigBlock(acctId)
      const refs = [...(detail.references ?? []), detail.messageId].filter(Boolean).join(' ')
      if (mode === 'forward') {
        setCompose({
          accountId: acctId,
          subject: `Fwd: ${detail.subject}`,
          body: sig + quote
        })
        return
      }
      const cc =
        mode === 'replyAll'
          ? detail.to.filter((a) => a && a !== acc?.email).join(', ')
          : ''
      setCompose({
        accountId: acctId,
        to: detail.fromAddress,
        cc,
        subject: detail.subject.startsWith('Re:') ? detail.subject : `Re: ${detail.subject}`,
        body: sig + quote,
        inReplyTo: detail.messageId,
        references: refs || undefined
      })
    },
    [detail, detailCtx, activeAccount, accounts, sigBlock]
  )

  const clientFilter = useCallback(
    (list: MessageSummary[]): MessageSummary[] => {
      let out = list
      if (listFilter === 'unread') out = out.filter((m) => !m.seen)
      else if (listFilter === 'flagged') out = out.filter((m) => m.flagged)
      else if (listFilter === 'attachments') out = out.filter((m) => m.hasAttachments)
      if (listMode === 'search') return out
      const q = query.trim().toLowerCase()
      if (!q) return out
      return out.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.fromName.toLowerCase().includes(q) ||
          m.fromAddress.toLowerCase().includes(q) ||
          m.snippet.toLowerCase().includes(q)
      )
    },
    [listFilter, query, listMode]
  )

  const displayMessages = useMemo(() => clientFilter(shown), [clientFilter, shown])

  const stepMessage = useCallback(
    (dir: 1 | -1) => {
      const list = displayMessages
      if (list.length === 0) return
      const idx = list.findIndex((m) => m.uid === selectedUid)
      const next = idx < 0 ? (dir === 1 ? 0 : list.length - 1) : idx + dir
      const target = list[Math.max(0, Math.min(list.length - 1, next))]
      if (target && target.uid !== selectedUid) openMessage(target.uid)
    },
    [displayMessages, selectedUid, openMessage]
  )

  const jumpMailbox = useCallback(
    (special: string) => {
      const box = mailboxes.find((m) => m.specialUse === special)
      if (box) openMailbox(box.path)
      else if (special === '\\Inbox') openMailbox('INBOX')
    },
    [mailboxes, openMailbox]
  )

  const allowRemoteSender = useCallback(() => {
    if (!detail?.fromAddress) return
    const domain = detail.fromAddress.split('@')[1]
    const entry = domain || detail.fromAddress
    if (!settings.remoteAllow.includes(entry)) {
      void saveSettings({ remoteAllow: [...settings.remoteAllow, entry] })
      pushToast(`Externe Inhalte von ${entry} immer erlauben`, 'success')
    }
  }, [detail, settings.remoteAllow, saveSettings, pushToast])

  const blockRemoteForDetail = useMemo(() => {
    if (!settings.blockRemoteContent || !detail) return false
    const addr = detail.fromAddress.toLowerCase()
    const domain = addr.split('@')[1] ?? ''
    return !settings.remoteAllow.some((e) => {
      const t = e.toLowerCase()
      return t === addr || t === domain
    })
  }, [settings.blockRemoteContent, settings.remoteAllow, detail])

  const toggleThread = useCallback((key: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = []
    if (activeAccount) {
      list.push({
        id: 'compose',
        title: 'Neue E-Mail',
        hint: 'C',
        icon: 'pencil',
        group: 'Aktionen',
        keywords: 'schreiben verfassen mail',
        run: composeNew
      })
    }
    if (accounts.length > 1) {
      list.push({
        id: 'unified',
        title: 'Gemeinsamer Posteingang',
        icon: 'layers',
        group: 'Aktionen',
        keywords: 'alle konten unified inbox',
        run: () => setView('unified')
      })
    }
    if (detail) {
      list.push(
        {
          id: 'reply',
          title: 'Antworten',
          hint: 'R',
          icon: 'reply',
          group: 'Aktionen',
          run: () => replySeed('reply')
        },
        {
          id: 'replyAll',
          title: 'Allen antworten',
          hint: 'A',
          icon: 'reply-all',
          group: 'Aktionen',
          run: () => replySeed('replyAll')
        },
        {
          id: 'forward',
          title: 'Weiterleiten',
          hint: 'F',
          icon: 'forward',
          group: 'Aktionen',
          run: () => replySeed('forward')
        },
        {
          id: 'seen',
          title: detail.seen ? 'Als ungelesen markieren' : 'Als gelesen markieren',
          hint: 'U',
          icon: 'mail-open',
          group: 'Aktionen',
          run: () => void toggleSeen(detail.uid, !detail.seen)
        },
        {
          id: 'flag',
          title: detail.flagged ? 'Markierung entfernen' : 'Markieren',
          hint: 'S',
          icon: 'star',
          group: 'Aktionen',
          keywords: 'stern favorit flag',
          run: () => void toggleFlag(detail.uid, !detail.flagged)
        }
      )
    }
    if (selectedUid !== null) {
      list.push(
        {
          id: 'archive',
          title: 'Archivieren',
          hint: 'E',
          icon: 'archive',
          group: 'Aktionen',
          run: () => archive(selectedUid)
        },
        {
          id: 'delete',
          title: 'Nachricht löschen',
          hint: 'Entf',
          icon: 'trash-2',
          group: 'Aktionen',
          run: () => void deleteMessage(selectedUid)
        }
      )
      for (const box of mailboxes) {
        if (box.path === ctxFor(selectedUid).mailbox) continue
        list.push({
          id: `move:${box.path}`,
          title: `Verschieben nach ${box.name}`,
          icon: 'inbox',
          group: 'Verschieben',
          keywords: 'move ordner',
          run: () => void moveMessage(selectedUid, box.path, box.name)
        })
      }
    }
    if (messages.some((m) => !m.seen)) {
      list.push({
        id: 'markAllSeen',
        title: 'Alle als gelesen markieren',
        icon: 'mail-check',
        group: 'Aktionen',
        keywords: 'ungelesen leeren alles',
        run: () => void markAllSeen()
      })
    }
    list.push(
      {
        id: 'threaded',
        title: threaded ? 'Threads ausschalten' : 'Nach Konversation gruppieren',
        icon: 'layers',
        group: 'Aktionen',
        keywords: 'thread konversation gruppieren',
        run: () => setThreaded((v) => !v)
      },
      {
        id: 'sync',
        title: 'Postfach aktualisieren',
        icon: 'refresh-cw',
        group: 'Aktionen',
        keywords: 'abrufen sync neu laden',
        run: () => void sync()
      },
      {
        id: 'temp',
        title: 'Wegwerf-Postfach öffnen',
        icon: 'clock',
        group: 'Aktionen',
        keywords: 'einweg temporär wegwerf mail.tm',
        run: () => setView('temp')
      },
      {
        id: 'settings',
        title: 'Einstellungen öffnen',
        icon: 'settings',
        group: 'Aktionen',
        keywords: 'konten optionen',
        run: () => setView('settings')
      },
      {
        id: 'theme',
        title: theme === 'dark' ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln',
        icon: theme === 'dark' ? 'sun' : 'moon',
        group: 'Aktionen',
        keywords: 'hell dunkel theme farbe',
        run: toggleTheme
      },
      {
        id: 'help',
        title: 'Tastaturkürzel anzeigen',
        hint: '?',
        icon: 'command',
        group: 'Aktionen',
        run: () => setHelpOpen(true)
      },
      {
        id: 'add-account',
        title: 'Konto hinzufügen',
        icon: 'plus',
        group: 'Konten',
        run: () => setAccountModal({})
      }
    )
    for (const box of mailboxes) {
      list.push({
        id: `box:${box.path}`,
        title: box.name,
        icon: 'inbox',
        group: 'Ordner',
        keywords: 'ordner wechseln öffnen',
        hint: box.unseen ? `${box.unseen} ungelesen` : undefined,
        run: () => openMailbox(box.path)
      })
    }
    for (const acc of accounts) {
      if (acc.id === activeAccountId) continue
      list.push({
        id: `acc:${acc.id}`,
        title: acc.label,
        icon: 'users',
        group: 'Konten',
        keywords: `${acc.email} konto wechseln postfach`,
        run: () => {
          setView('mail')
          setActiveAccountId(acc.id)
        }
      })
    }
    return list
  }, [
    activeAccount,
    activeAccountId,
    accounts,
    mailboxes,
    messages,
    detail,
    selectedUid,
    theme,
    threaded,
    composeNew,
    replySeed,
    toggleSeen,
    toggleFlag,
    deleteMessage,
    archive,
    moveMessage,
    ctxFor,
    markAllSeen,
    sync,
    toggleTheme,
    openMailbox
  ])

  const accountColors = useMemo(() => {
    const map: Record<string, string> = {}
    for (const a of accounts) map[a.id] = a.color
    return map
  }, [accounts])

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
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        composeNew()
        return
      }
      if (mod) return

      if (e.key === 'Escape') {
        if (paletteOpen) setPaletteOpen(false)
        else if (helpOpen) setHelpOpen(false)
        else if (accountPopover) setAccountPopover(false)
        else if (searchResults) exitSearch()
        else if (selectedUid !== null) {
          setSelectedUid(null)
          setDetail(null)
        }
        return
      }

      if (paletteOpen || helpOpen || typing || compose || accountModal) return

      if (goChord.current) {
        goChord.current = false
        const special = {
          i: '\\Inbox',
          s: '\\Sent',
          e: '\\Drafts',
          t: '\\Trash',
          j: '\\Junk',
          a: '\\Archive'
        }[e.key.toLowerCase()]
        if (special) {
          e.preventDefault()
          jumpMailbox(special)
        }
        return
      }
      if (e.key === 'g') {
        goChord.current = true
        window.setTimeout(() => (goChord.current = false), 900)
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        setHelpOpen(true)
      } else if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'c') {
        e.preventDefault()
        composeNew()
      } else if ((e.key === 'j' || e.key === 'ArrowDown') && (view === 'mail' || view === 'unified')) {
        e.preventDefault()
        stepMessage(1)
      } else if ((e.key === 'k' || e.key === 'ArrowUp') && (view === 'mail' || view === 'unified')) {
        e.preventDefault()
        stepMessage(-1)
      } else if (e.key === 'r' && detail) replySeed('reply')
      else if (e.key === 'a' && detail) replySeed('replyAll')
      else if (e.key === 'f' && detail) replySeed('forward')
      else if (e.key === 'e' && selectedUid !== null) archive(selectedUid)
      else if (e.key === 'U' && view === 'mail') void markAllSeen()
      else if (e.key === 'u' && detail) void toggleSeen(detail.uid, !detail.seen)
      else if (e.key === 's' && detail) void toggleFlag(detail.uid, !detail.flagged)
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedUid !== null)
        void deleteMessage(selectedUid)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    activeAccount,
    compose,
    accountModal,
    detail,
    selectedUid,
    view,
    paletteOpen,
    helpOpen,
    accountPopover,
    searchResults,
    exitSearch,
    composeNew,
    replySeed,
    deleteMessage,
    archive,
    toggleSeen,
    toggleFlag,
    markAllSeen,
    stepMessage,
    jumpMailbox
  ])

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
        : view === 'unified'
          ? 'Alle Konten'
          : searchResults
            ? `Suche: „${query}"`
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
          onUnified={() => setView('unified')}
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

        {view !== 'unified' && (
          <Sidebar
            mailboxes={mailboxes}
            activeMailbox={activeMailbox}
            view={view === 'settings' || view === 'temp' ? view : 'mail'}
            onSelectMailbox={openMailbox}
            onOpenTemp={() => setView('temp')}
            onCompose={composeNew}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        )}

        {view === 'temp' ? (
          <TempMailView
            density={density}
            newMailTick={tempTick}
            onToast={(text, tone) => pushToast(text, tone)}
            onOpenExternal={(url) => api.openExternal(url)}
          />
        ) : view === 'settings' ? (
          <Settings
            accounts={accounts}
            settings={settings}
            theme={theme}
            density={density}
            version={appVersion}
            onSettings={saveSettings}
            onToggleTheme={toggleTheme}
            onDensity={setDensity}
            onEdit={(a) => setAccountModal({ account: a })}
            onAdd={() => setAccountModal({})}
            onDemo={createDemoAccount}
            onClose={() => setView('mail')}
            onCheckUpdate={() => {
              pushToast('Suche nach Updates …', 'info')
              void api.update.check()
            }}
          />
        ) : (
          <div className="flex min-h-0 flex-1">
            <MessageList
              inputRef={searchRef}
              messages={displayMessages}
              loading={loadingList || searching}
              selectedUid={selectedUid}
              query={query}
              filter={listFilter}
              accountName={view === 'unified' ? 'allen Konten' : activeAccount?.label}
              checked={checked}
              selectMode={selectMode}
              threaded={threaded}
              onToggleThreaded={() => setThreaded((v) => !v)}
              expandedThreads={expandedThreads}
              onToggleThread={toggleThread}
              hasMore={listMode === 'folder' && hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              accountColors={accountColors}
              showAccountDot={listMode !== 'folder'}
              onSearchSubmit={view === 'unified' ? undefined : () => runSearch(searchScope)}
              searchScope={searchScope}
              onToggleScope={() =>
                runSearch(searchScope === 'mailbox' ? 'all' : 'mailbox')
              }
              searchActive={listMode === 'search'}
              onQuery={(v) => {
                setQuery(v)
                if (!v && searchResults) setSearchResults(null)
              }}
              onFilter={setListFilter}
              onSync={sync}
              onMarkAllSeen={view === 'unified' ? undefined : markAllSeen}
              onToggleSelectMode={() => {
                setSelectMode((v) => !v)
                setChecked(new Set())
              }}
              onSelect={openMessage}
              onToggleCheck={toggleCheck}
              onClearChecked={() => setChecked(new Set())}
              onBulkMarkSeen={bulkMarkSeen}
              onBulkDelete={bulkDelete}
              onBulkArchive={bulkArchive}
              onToggleFlag={toggleFlag}
              onDelete={deleteMessage}
              onArchive={archive}
            />
            <MessageView
              detail={detail}
              loading={loadingDetail}
              hasSelection={selectedUid !== null}
              theme={theme}
              blockRemote={blockRemoteForDetail}
              onAllowRemote={allowRemoteSender}
              onReply={() => replySeed('reply')}
              onReplyAll={() => replySeed('replyAll')}
              onForward={() => replySeed('forward')}
              onDelete={() => selectedUid !== null && deleteMessage(selectedUid)}
              onArchive={() => selectedUid !== null && archive(selectedUid)}
              onToggleFlag={(v) => selectedUid !== null && toggleFlag(selectedUid, v)}
              onOpenExternal={(url) => api.openExternal(url)}
              onSaveAttachment={saveAttachment}
              onPreviewAttachment={previewAttachment}
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
        onCommand={() => setPaletteOpen(true)}
      />

      <Toasts toasts={toasts} onClose={dismissToast} />

      {paletteOpen && (
        <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />
      )}

      {helpOpen && <ShortcutSheet onClose={() => setHelpOpen(false)} />}

      {compose && (
        <ComposeModal
          seed={compose}
          accounts={accounts}
          draftsPath={draftsPath}
          onClose={() => setCompose(null)}
          onSend={handleSend}
          onSaveDraft={handleSaveDraft}
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
