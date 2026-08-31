import { ImapFlow, type ImapFlowOptions } from 'imapflow'
import { simpleParser } from 'mailparser'
import { EventEmitter } from 'events'
import { accountStore } from '../store'
import { getAccessToken } from '../oauth'
import type {
  ConnectionStatus,
  MailboxNode,
  MessageDetail,
  MessageSummary,
  NewMailEvent
} from '../../shared/types'

const PAGE_SIZE = 50

function decodeSnippet(text: string | undefined): string {
  if (!text) return ''
  return text.replace(/\s+/g, ' ').trim().slice(0, 200)
}

interface StructNode {
  part?: string
  type?: string
  encoding?: string
  parameters?: { charset?: string }
  disposition?: string
  childNodes?: StructNode[]
}

interface SnippetPart {
  id: string
  encoding?: string
  charset?: string
  isHtml: boolean
}

function collectLeaves(node: StructNode | undefined, out: StructNode[]): void {
  if (!node) return
  if (node.childNodes?.length) {
    for (const child of node.childNodes) collectLeaves(child, out)
  } else {
    out.push(node)
  }
}

/** Sucht in der bodyStructure den Teil, der sich als Vorschautext eignet (bevorzugt text/plain). */
function pickSnippetPart(structure: unknown): SnippetPart | undefined {
  const leaves: StructNode[] = []
  collectLeaves(structure as StructNode, leaves)
  const text = leaves.filter(
    (l) =>
      l.disposition !== 'attachment' &&
      (l.type === 'text/plain' || l.type === 'text/html')
  )
  const chosen = text.find((l) => l.type === 'text/plain') ?? text[0]
  if (!chosen) return undefined
  return {
    id: chosen.part || '1',
    encoding: chosen.encoding,
    charset: chosen.parameters?.charset,
    isHtml: chosen.type === 'text/html'
  }
}

function decodeQuotedPrintable(input: string): Buffer {
  const clean = input.replace(/=\r?\n/g, '')
  const bytes: number[] = []
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(clean.substr(i + 1, 2))) {
      bytes.push(parseInt(clean.substr(i + 1, 2), 16))
      i += 2
    } else {
      bytes.push(ch.charCodeAt(0) & 0xff)
    }
  }
  return Buffer.from(bytes)
}

function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(style|script|head|title)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => {
      try {
        return String.fromCodePoint(Number(d))
      } catch {
        return ' '
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16))
      } catch {
        return ' '
      }
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** Wandelt den rohen (transfer-codierten) Teilinhalt in lesbaren Text um. */
function decodeBodyPart(raw: Buffer, part: SnippetPart): string {
  const enc = (part.encoding || '').toLowerCase()
  let buf: Buffer
  if (enc === 'base64') buf = Buffer.from(raw.toString('latin1'), 'base64')
  else if (enc === 'quoted-printable') buf = decodeQuotedPrintable(raw.toString('latin1'))
  else buf = raw

  let text: string
  try {
    text = new TextDecoder(part.charset || 'utf-8').decode(buf)
  } catch {
    text = buf.toString('utf-8')
  }
  return part.isHtml ? htmlToText(text) : text
}

function addrList(value: unknown): string[] {
  const v = value as { value?: { name?: string; address?: string }[] } | undefined
  if (!v?.value) return []
  return v.value.map((a) => a.name || a.address || '').filter(Boolean)
}

interface EnvelopeAddress {
  name?: string
  address?: string
}

function summaryFromFetch(msg: {
  uid: number
  seq: number
  flags?: Set<string>
  envelope?: {
    subject?: string
    from?: EnvelopeAddress[]
    to?: EnvelopeAddress[]
    date?: Date
  }
  bodyStructure?: unknown
}): MessageSummary {
  const env = msg.envelope ?? {}
  const from = env.from?.[0] ?? {}
  const flags = msg.flags ?? new Set<string>()
  return {
    uid: msg.uid,
    seq: msg.seq,
    subject: env.subject || '(kein Betreff)',
    fromName: from.name || from.address || 'Unbekannt',
    fromAddress: from.address || '',
    to: (env.to ?? []).map((a) => a.address || '').filter(Boolean),
    date: (env.date ?? new Date()).toISOString(),
    seen: flags.has('\\Seen'),
    flagged: flags.has('\\Flagged'),
    hasAttachments: hasAttachments(msg.bodyStructure),
    snippet: ''
  }
}

function hasAttachments(structure: unknown): boolean {
  const node = structure as { disposition?: string; childNodes?: unknown[] } | undefined
  if (!node) return false
  if (node.disposition === 'attachment') return true
  return (node.childNodes ?? []).some((c) => hasAttachments(c))
}

/**
 * Verwaltet zwei IMAP-Verbindungen pro Konto:
 *  - idleClient: dauerhaft auf INBOX, meldet neue Mails
 *  - workClient: für Ordnerwechsel, Abrufe, Flags
 */
export class AccountConnection {
  readonly accountId: string
  private idleClient: ImapFlow | null = null
  private workClient: ImapFlow | null = null
  private lastUid = 0
  private closed = false
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor(
    accountId: string,
    private readonly bus: EventEmitter
  ) {
    this.accountId = accountId
  }

  private async options(): Promise<ImapFlowOptions> {
    const acc = accountStore.get(this.accountId)
    if (!acc) throw new Error('Konto nicht gefunden')
    const auth =
      acc.authType === 'oauth'
        ? { user: acc.email, accessToken: await getAccessToken(this.accountId) }
        : { user: acc.user, pass: accountStore.password(this.accountId) }
    return {
      host: acc.imap.host,
      port: acc.imap.port,
      secure: acc.imap.secure,
      auth,
      logger: false,
      emitLogs: false,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 60000
    }
  }

  private emitStatus(state: ConnectionStatus['state'], message?: string): void {
    this.bus.emit('status', { accountId: this.accountId, state, message } as ConnectionStatus)
  }

  async start(): Promise<void> {
    this.closed = false
    await this.ensureWork()
    await this.startIdle()
  }

  private async ensureWork(): Promise<ImapFlow> {
    if (this.workClient?.usable) return this.workClient
    this.emitStatus('connecting')
    const client = new ImapFlow(await this.options())
    client.on('error', () => {})
    await client.connect()
    this.workClient = client
    this.emitStatus('online')
    return client
  }

  private async startIdle(): Promise<void> {
    if (this.closed) return
    try {
      const client = new ImapFlow(await this.options())
      client.on('error', () => {})
      client.on('close', () => this.scheduleReconnect())
      await client.connect()
      const mbox = await client.mailboxOpen('INBOX')
      this.lastUid = mbox.uidNext - 1
      client.on('exists', () => {
        this.handleNewMail().catch(() => {})
      })
      this.idleClient = client
      this.emitStatus('online')
    } catch (err) {
      this.emitStatus('error', (err as Error).message)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return
    this.emitStatus('offline')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.startIdle().catch(() => {})
    }, 5000)
  }

  private async handleNewMail(): Promise<void> {
    const client = this.idleClient
    if (!client?.usable) return
    const since = this.lastUid + 1
    const range = `${since}:*`
    const pending: { summary: MessageSummary; uid: number; part?: SnippetPart }[] = []
    for await (const msg of client.fetch(
      range,
      { uid: true, envelope: true, flags: true, bodyStructure: true },
      { uid: true }
    )) {
      if (msg.uid <= this.lastUid) continue
      this.lastUid = msg.uid
      pending.push({
        summary: summaryFromFetch(msg),
        uid: msg.uid,
        part: pickSnippetPart(msg.bodyStructure)
      })
    }
    for (const row of pending) {
      if (row.part) {
        try {
          const one = await client.fetchOne(
            String(row.uid),
            { bodyParts: [row.part.id] },
            { uid: true }
          )
          const raw = one ? one.bodyParts?.get(row.part.id) : undefined
          if (raw) row.summary.snippet = decodeSnippet(decodeBodyPart(raw, row.part))
        } catch {
          /* Vorschautext ist optional */
        }
      }
      this.bus.emit('newMail', {
        accountId: this.accountId,
        mailbox: 'INBOX',
        message: row.summary
      } as NewMailEvent)
    }
  }

  async listMailboxes(): Promise<MailboxNode[]> {
    const client = await this.ensureWork()
    const boxes = await client.list()
    const nodes: MailboxNode[] = []
    for (const box of boxes) {
      let unseen = 0
      let total = 0
      try {
        const status = await client.status(box.path, { messages: true, unseen: true })
        unseen = status.unseen ?? 0
        total = status.messages ?? 0
      } catch {
        /* Ordner ohne SELECT-Recht überspringen */
      }
      nodes.push({
        path: box.path,
        name: box.name,
        specialUse: box.specialUse,
        unseen,
        total
      })
    }
    return nodes
  }

  async listMessages(mailbox: string, page = 0): Promise<MessageSummary[]> {
    const client = await this.ensureWork()
    const lock = await client.getMailboxLock(mailbox)
    try {
      const total =
        typeof client.mailbox === 'object' ? client.mailbox.exists : 0
      if (!total) return []
      const end = Math.max(1, total - page * PAGE_SIZE)
      const start = Math.max(1, end - PAGE_SIZE + 1)
      const range = `${start}:${end}`

      const rows: { summary: MessageSummary; seq: number; part?: SnippetPart }[] = []
      for await (const msg of client.fetch(
        range,
        { envelope: true, flags: true, bodyStructure: true },
        {}
      )) {
        rows.push({
          summary: summaryFromFetch(msg),
          seq: msg.seq,
          part: pickSnippetPart(msg.bodyStructure)
        })
      }

      // zweiter, schlanker Durchlauf: nur die für die Vorschau nötigen Teile laden und decodieren
      const partIds = [
        ...new Set(rows.map((r) => r.part?.id).filter((v): v is string => Boolean(v)))
      ]
      if (partIds.length) {
        const bySeq = new Map(rows.map((r) => [r.seq, r]))
        for await (const msg of client.fetch(range, { bodyParts: partIds }, {})) {
          const row = bySeq.get(msg.seq)
          if (!row?.part) continue
          const raw = msg.bodyParts?.get(row.part.id)
          if (raw) row.summary.snippet = decodeSnippet(decodeBodyPart(raw, row.part))
        }
      }

      return rows.map((r) => r.summary).reverse()
    } finally {
      lock.release()
    }
  }

  async getMessage(mailbox: string, uid: number): Promise<MessageDetail> {
    const client = await this.ensureWork()
    const lock = await client.getMailboxLock(mailbox)
    try {
      const { content } = await client.download(String(uid), undefined, { uid: true })
      const parsed = await simpleParser(content)
      const fromAddr = parsed.from?.value?.[0]
      return {
        uid,
        seq: 0,
        subject: parsed.subject || '(kein Betreff)',
        fromName: fromAddr?.name || fromAddr?.address || 'Unbekannt',
        fromAddress: fromAddr?.address || '',
        to: addrList(parsed.to),
        cc: addrList(parsed.cc),
        date: (parsed.date ?? new Date()).toISOString(),
        seen: true,
        flagged: false,
        hasAttachments: (parsed.attachments?.length ?? 0) > 0,
        snippet: decodeSnippet(parsed.text),
        html: typeof parsed.html === 'string' ? parsed.html : null,
        text: parsed.text ?? null,
        attachments: (parsed.attachments ?? []).map((a, index) => ({
          filename: a.filename || 'anhang',
          contentType: a.contentType || 'application/octet-stream',
          size: a.size || 0,
          index
        }))
      }
    } finally {
      lock.release()
    }
  }

  /** Lädt einen einzelnen Anhang einer Nachricht als Buffer (für „Anhang speichern"). */
  async downloadAttachment(
    mailbox: string,
    uid: number,
    index: number
  ): Promise<{ filename: string; content: Buffer }> {
    const client = await this.ensureWork()
    const lock = await client.getMailboxLock(mailbox)
    try {
      const { content } = await client.download(String(uid), undefined, { uid: true })
      const parsed = await simpleParser(content)
      const att = parsed.attachments?.[index]
      if (!att) throw new Error('Anhang nicht gefunden')
      return { filename: att.filename || 'anhang', content: att.content as Buffer }
    } finally {
      lock.release()
    }
  }

  async markAllSeen(mailbox: string): Promise<void> {
    const client = await this.ensureWork()
    const lock = await client.getMailboxLock(mailbox)
    try {
      await client.messageFlagsAdd('1:*', ['\\Seen'], { uid: true })
    } finally {
      lock.release()
    }
  }

  async setFlag(
    mailbox: string,
    uid: number,
    flag: '\\Seen' | '\\Flagged',
    value: boolean
  ): Promise<void> {
    const client = await this.ensureWork()
    const lock = await client.getMailboxLock(mailbox)
    try {
      if (value) await client.messageFlagsAdd(String(uid), [flag], { uid: true })
      else await client.messageFlagsRemove(String(uid), [flag], { uid: true })
    } finally {
      lock.release()
    }
  }

  async deleteMessage(mailbox: string, uid: number): Promise<void> {
    const client = await this.ensureWork()
    const lock = await client.getMailboxLock(mailbox)
    try {
      await client.messageDelete(String(uid), { uid: true })
    } finally {
      lock.release()
    }
  }

  async stop(): Promise<void> {
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    await Promise.allSettled([
      this.idleClient?.logout(),
      this.workClient?.logout()
    ])
    this.idleClient = null
    this.workClient = null
  }
}

export async function testConnection(opts: {
  imap: { host: string; port: number; secure: boolean }
  user: string
  password: string
}): Promise<void> {
  if (!opts.imap.host) throw new Error('IMAP-Server fehlt')
  const client = new ImapFlow({
    host: opts.imap.host,
    port: opts.imap.port,
    secure: opts.imap.secure,
    auth: { user: opts.user, pass: opts.password },
    logger: false,
    emitLogs: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  })
  client.on('error', () => {})
  try {
    await client.connect()
    await client.logout()
  } catch (err) {
    throw new Error(`IMAP (${opts.imap.host}:${opts.imap.port}): ${(err as Error).message}`)
  }
}
