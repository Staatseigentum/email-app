import { EventEmitter } from 'events'
import { randomBytes, randomUUID } from 'crypto'
import type { EventEmitter as Bus } from 'events'
import type {
  MailboxNode,
  MessageDetail,
  MessageSummary,
  NewMailEvent,
  TempMailbox
} from '../../shared/types'
import { tempStore } from '../tempStore'

const BASE = 'https://api.mail.tm'
const POLL_MS = 12_000

/** mail.tm liefert Sammlungen je nach Accept-Header als reines Array oder als Hydra-Objekt. */
function members<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[]
  if (body && typeof body === 'object') {
    const h = (body as Record<string, unknown>)['hydra:member']
    if (Array.isArray(h)) return h as T[]
  }
  return []
}
interface TmDomain {
  domain: string
  isActive: boolean
  isPrivate: boolean
}
interface TmAddress {
  address: string
  name?: string
}
interface TmMessageListItem {
  id: string
  from: TmAddress
  subject: string
  intro: string
  seen: boolean
  hasAttachments: boolean
  createdAt: string
}
interface TmAttachment {
  id: string
  filename: string
  contentType: string
  size: number
  downloadUrl: string
}
interface TmMessageFull extends TmMessageListItem {
  to: TmAddress[]
  cc: TmAddress[]
  text?: string
  html?: string[]
  attachments: TmAttachment[]
}

function stableUid(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i)
  return Math.abs(hash) || 1
}

function snippet(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 200)
}

async function raw(
  path: string,
  init: RequestInit & { token?: string } = {}
): Promise<Response> {
  const { token, ...rest } = init
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(rest.headers as Record<string, string> | undefined)
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (rest.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const res = await fetch(path.startsWith('http') ? path : `${BASE}${path}`, {
    ...rest,
    headers
  })
  return res
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { 'hydra:description'?: string; detail?: string; message?: string }
      detail = body['hydra:description'] || body.detail || body.message || ''
    } catch {
      /* ignore */
    }
    throw new Error(
      `mail.tm ${res.status}${detail ? `: ${detail}` : ''}` +
        (res.status === 429 ? ' (zu viele Anfragen – kurz warten)' : '')
    )
  }
  return (await res.json()) as T
}

/** Verwaltet Wegwerf-Postfächer (mail.tm): anlegen, abrufen, aktiv-Polling. */
export class TempMailService {
  private uidMap = new Map<string, Map<number, string>>()
  private active: string | null = null
  private timer: NodeJS.Timeout | null = null
  private knownIds = new Set<string>()
  private failStreak = 0

  constructor(private readonly bus: Bus = new EventEmitter()) {}

  list(): TempMailbox[] {
    return tempStore.list()
  }

  async create(): Promise<TempMailbox> {
    const domains = members<TmDomain>(await json(await raw('/domains')))
    const domain = domains.find((d) => d.isActive && !d.isPrivate) ?? domains[0]
    if (!domain) throw new Error('mail.tm bietet gerade keine Domain an – später erneut versuchen.')

    const address = `mw-${randomBytes(4).toString('hex')}@${domain.domain}`
    const password = randomUUID()

    const account = await json<{ id: string }>(
      await raw('/accounts', { method: 'POST', body: JSON.stringify({ address, password }) })
    )
    const auth = await json<{ token: string }>(
      await raw('/token', { method: 'POST', body: JSON.stringify({ address, password }) })
    )
    return tempStore.add({ accountId: account.id, address, password, token: auth.token })
  }

  async remove(id: string): Promise<boolean> {
    try {
      const s = tempStore.secrets(id)
      await raw(`/accounts/${s.accountId}`, { method: 'DELETE', token: s.token })
    } catch {
      /* best effort – lokal trotzdem entfernen */
    }
    if (this.active === id) this.setActive(null)
    tempStore.remove(id)
    this.uidMap.delete(id)
    return true
  }

  private async withToken<T>(id: string, fn: (token: string) => Promise<Response>): Promise<T> {
    let s = tempStore.secrets(id)
    let res = await fn(s.token)
    if (res.status === 401) {
      const auth = await json<{ token: string }>(
        await raw('/token', {
          method: 'POST',
          body: JSON.stringify({ address: s.address, password: s.password })
        })
      )
      tempStore.updateToken(id, auth.token)
      s = { ...s, token: auth.token }
      res = await fn(s.token)
    }
    return json<T>(res)
  }

  mailboxes(): MailboxNode[] {
    return [{ path: 'INBOX', name: 'Posteingang', specialUse: '\\Inbox', unseen: 0, total: 0 }]
  }

  async messages(id: string): Promise<MessageSummary[]> {
    const data = members<TmMessageListItem>(
      await this.withToken<unknown>(id, (t) => raw('/messages?page=1', { token: t }))
    )
    const map = new Map<number, string>()
    const out = data.map((m) => {
      const uid = stableUid(m.id)
      map.set(uid, m.id)
      return {
        uid,
        seq: uid,
        subject: m.subject || '(kein Betreff)',
        fromName: m.from?.name || m.from?.address || 'Unbekannt',
        fromAddress: m.from?.address || '',
        to: [],
        date: m.createdAt,
        seen: m.seen,
        flagged: false,
        hasAttachments: m.hasAttachments,
        snippet: snippet(m.intro || '')
      } satisfies MessageSummary
    })
    this.uidMap.set(id, map)
    return out
  }

  private async resolveMsgId(id: string, uid: number): Promise<string> {
    let msgId = this.uidMap.get(id)?.get(uid)
    if (!msgId) {
      await this.messages(id)
      msgId = this.uidMap.get(id)?.get(uid)
    }
    if (!msgId) throw new Error('Nachricht nicht gefunden')
    return msgId
  }

  async message(id: string, uid: number): Promise<MessageDetail> {
    const msgId = await this.resolveMsgId(id, uid)
    const m = await this.withToken<TmMessageFull>(id, (t) =>
      raw(`/messages/${msgId}`, { token: t })
    )
    // als gelesen markieren (best effort)
    this.withToken(id, (t) =>
      raw(`/messages/${msgId}`, {
        method: 'PATCH',
        token: t,
        headers: { 'Content-Type': 'application/merge-patch+json' },
        body: JSON.stringify({ seen: true })
      })
    ).catch(() => {})

    return {
      uid,
      seq: uid,
      subject: m.subject || '(kein Betreff)',
      fromName: m.from?.name || m.from?.address || 'Unbekannt',
      fromAddress: m.from?.address || '',
      to: (m.to ?? []).map((a) => a.address).filter(Boolean),
      cc: (m.cc ?? []).map((a) => a.address).filter(Boolean),
      date: m.createdAt,
      seen: true,
      flagged: false,
      hasAttachments: m.hasAttachments,
      snippet: snippet(m.text || m.intro || ''),
      html: m.html?.join('\n') || null,
      text: m.text || null,
      attachments: (m.attachments ?? []).map((a, index) => ({
        filename: a.filename || 'anhang',
        contentType: a.contentType || 'application/octet-stream',
        size: a.size || 0,
        index
      }))
    }
  }

  async markAllSeen(id: string): Promise<void> {
    const data = members<TmMessageListItem>(
      await this.withToken<unknown>(id, (t) => raw('/messages?page=1', { token: t }))
    )
    for (const m of data) {
      if (m.seen) continue
      await this.withToken(id, (t) =>
        raw(`/messages/${m.id}`, {
          method: 'PATCH',
          token: t,
          headers: { 'Content-Type': 'application/merge-patch+json' },
          body: JSON.stringify({ seen: true })
        })
      ).catch(() => {})
    }
  }

  async downloadAttachment(
    id: string,
    uid: number,
    index: number
  ): Promise<{ filename: string; content: Buffer }> {
    const msgId = await this.resolveMsgId(id, uid)
    const m = await this.withToken<TmMessageFull>(id, (t) =>
      raw(`/messages/${msgId}`, { token: t })
    )
    const att = m.attachments?.[index]
    if (!att) throw new Error('Anhang nicht gefunden')
    const res = await this.withTokenRaw(id, (t) => raw(att.downloadUrl, { token: t }))
    const buf = Buffer.from(await res.arrayBuffer())
    return { filename: att.filename || 'anhang', content: buf }
  }

  private async withTokenRaw(
    id: string,
    fn: (token: string) => Promise<Response>
  ): Promise<Response> {
    let s = tempStore.secrets(id)
    let res = await fn(s.token)
    if (res.status === 401) {
      const auth = await json<{ token: string }>(
        await raw('/token', {
          method: 'POST',
          body: JSON.stringify({ address: s.address, password: s.password })
        })
      )
      tempStore.updateToken(id, auth.token)
      res = await fn(auth.token)
    }
    if (!res.ok) throw new Error(`mail.tm ${res.status}`)
    return res
  }

  /** Startet/stoppt das Polling für das gerade angezeigte Postfach. */
  setActive(id: string | null): void {
    if (this.active === id) return
    this.active = id
    this.knownIds.clear()
    this.failStreak = 0
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (!id) return
    // erste Runde: aktuellen Stand als „bekannt" merken, nicht benachrichtigen
    void this.poll(true)
    this.timer = setInterval(() => void this.poll(false), POLL_MS)
  }

  private async poll(prime: boolean): Promise<void> {
    const id = this.active
    if (!id) return
    try {
      const data = members<TmMessageListItem>(
        await this.withToken<unknown>(id, (t) => raw('/messages?page=1', { token: t }))
      )
      this.failStreak = 0
      for (const m of data) {
        if (this.knownIds.has(m.id)) continue
        this.knownIds.add(m.id)
        if (prime) continue
        const uid = stableUid(m.id)
        this.uidMap.get(id)?.set(uid, m.id)
        this.bus.emit('newMail', {
          accountId: `temp:${id}`,
          mailbox: 'INBOX',
          message: {
            uid,
            seq: uid,
            subject: m.subject || '(kein Betreff)',
            fromName: m.from?.name || m.from?.address || 'Unbekannt',
            fromAddress: m.from?.address || '',
            to: [],
            date: m.createdAt,
            seen: false,
            flagged: false,
            hasAttachments: m.hasAttachments,
            snippet: snippet(m.intro || '')
          }
        } satisfies NewMailEvent)
      }
    } catch {
      // bei wiederholten Fehlern Polling ausdünnen
      this.failStreak++
      if (this.failStreak >= 3 && this.timer) {
        clearInterval(this.timer)
        this.timer = setInterval(() => void this.poll(false), POLL_MS * 4)
      }
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.active = null
  }
}
