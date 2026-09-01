import { EventEmitter } from 'events'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type {
  ComposePayload,
  MailboxNode,
  MessageDetail,
  MessageSummary,
  NewMailEvent
} from '../../shared/types'

interface DemoMessage {
  uid: number
  mailbox: string
  subject: string
  fromName: string
  fromAddress: string
  to: string[]
  cc: string[]
  date: string
  seen: boolean
  flagged: boolean
  html: string | null
  text: string
  attachments?: { filename: string; contentType: string; size: number }[]
}

interface DemoData {
  nextUid: number
  messages: DemoMessage[]
}

const FOLDERS: { path: string; name: string; specialUse?: string }[] = [
  { path: 'INBOX', name: 'Posteingang', specialUse: '\\Inbox' },
  { path: 'Sent', name: 'Gesendet', specialUse: '\\Sent' },
  { path: 'Drafts', name: 'Entwürfe', specialUse: '\\Drafts' },
  { path: 'Archive', name: 'Archiv', specialUse: '\\Archive' },
  { path: 'Trash', name: 'Papierkorb', specialUse: '\\Trash' }
]

function seed(): DemoData {
  const now = Date.now()
  const m = (
    uid: number,
    mins: number,
    partial: Partial<DemoMessage> & { subject: string; text: string }
  ): DemoMessage => ({
    uid,
    mailbox: 'INBOX',
    fromName: 'MailWave',
    fromAddress: 'team@mailwave.app',
    to: ['du@demo.mailwave.app'],
    cc: [],
    date: new Date(now - mins * 60000).toISOString(),
    seen: false,
    flagged: false,
    html: null,
    ...partial
  })

  return {
    nextUid: 6,
    messages: [
      m(1, 4, {
        subject: 'Willkommen bei MailWave 👋',
        fromName: 'MailWave Team',
        html: `<h2>Schön, dass du da bist!</h2>
<p>Dies ist ein <strong>Demo-Postfach</strong> – komplett offline, ohne echten Server.
Du kannst hier gefahrlos alles ausprobieren:</p>
<ul>
  <li>Nachrichten öffnen, als gelesen/ungelesen markieren</li>
  <li>Mit dem Stern markieren oder löschen</li>
  <li>Über „Neue E-Mail" schreiben – sie landet im Ordner <em>Gesendet</em></li>
  <li>Antworte auf diese Mail und du bekommst ein paar Sekunden später
      eine Desktop-Benachrichtigung mit einer automatischen Antwort</li>
</ul>
<p>Viel Spaß! 🌊</p>`,
        text: 'Willkommen bei MailWave – Demo-Postfach. Probiere alles gefahrlos aus.'
      }),
      m(2, 55, {
        subject: 'Deine Rechnung für August',
        fromName: 'Buchhaltung',
        fromAddress: 'rechnung@example.com',
        text:
          'Hallo,\n\nanbei die Übersicht für den Monat August. Der Betrag von 49,00 € wurde abgebucht.\n\nViele Grüße\nDie Buchhaltung'
      }),
      m(3, 190, {
        subject: 'Mittagessen morgen?',
        fromName: 'Lena Hoffmann',
        fromAddress: 'lena@example.com',
        seen: true,
        text: 'Hey! Hast du morgen um 12:30 Zeit für einen schnellen Lunch? LG Lena'
      }),
      m(4, 1500, {
        subject: 'Newsletter: 5 Tipps für einen aufgeräumten Posteingang',
        fromName: 'Produktivität Weekly',
        fromAddress: 'hello@newsletter.example',
        seen: true,
        flagged: true,
        text: '1. Inbox Zero\n2. Filter\n3. Zwei-Minuten-Regel\n4. Abbestellen\n5. Feste Zeiten'
      }),
      {
        uid: 5,
        mailbox: 'Sent',
        subject: 'Re: Projektstatus',
        fromName: 'Ich',
        fromAddress: 'du@demo.mailwave.app',
        to: ['chef@example.com'],
        cc: [],
        date: new Date(now - 3 * 3600000).toISOString(),
        seen: true,
        flagged: false,
        html: null,
        text: 'Hi, der Status ist grün – wir liegen gut in der Zeit. Grüße'
      }
    ]
  }
}

export class DemoConnection {
  readonly accountId: string
  private data: DemoData
  private timers: NodeJS.Timeout[] = []

  constructor(
    accountId: string,
    private readonly bus: EventEmitter
  ) {
    this.accountId = accountId
    this.data = this.load()
  }

  private file(): string {
    const dir = join(app.getPath('userData'), 'data')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return join(dir, `demo-${this.accountId}.json`)
  }

  private load(): DemoData {
    try {
      if (existsSync(this.file())) return JSON.parse(readFileSync(this.file(), 'utf-8'))
    } catch {
      /* neu aufsetzen */
    }
    const data = seed()
    this.persist(data)
    return data
  }

  private persist(data = this.data): void {
    writeFileSync(this.file(), JSON.stringify(data, null, 2), 'utf-8')
  }

  private toSummary(msg: DemoMessage): MessageSummary {
    return {
      uid: msg.uid,
      seq: msg.uid,
      subject: msg.subject,
      fromName: msg.fromName,
      fromAddress: msg.fromAddress,
      to: msg.to,
      date: msg.date,
      seen: msg.seen,
      flagged: msg.flagged,
      hasAttachments: (msg.attachments?.length ?? 0) > 0,
      snippet: msg.text.replace(/\s+/g, ' ').trim().slice(0, 200)
    }
  }

  async start(): Promise<void> {
    this.bus.emit('status', { accountId: this.accountId, state: 'online' })
  }

  async stop(): Promise<void> {
    this.timers.forEach(clearTimeout)
    this.timers = []
  }

  async listMailboxes(): Promise<MailboxNode[]> {
    return FOLDERS.map((f) => {
      const inFolder = this.data.messages.filter((m) => m.mailbox === f.path)
      return {
        ...f,
        total: inFolder.length,
        unseen: inFolder.filter((m) => !m.seen).length
      }
    })
  }

  async listMessages(mailbox: string): Promise<MessageSummary[]> {
    return this.data.messages
      .filter((m) => m.mailbox === mailbox)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .map((m) => this.toSummary(m))
  }

  async getMessage(mailbox: string, uid: number): Promise<MessageDetail> {
    const msg = this.data.messages.find((m) => m.mailbox === mailbox && m.uid === uid)
    if (!msg) throw new Error('Nachricht nicht gefunden')
    msg.seen = true
    this.persist()
    return {
      ...this.toSummary(msg),
      seen: true,
      cc: msg.cc,
      html: msg.html,
      text: msg.text,
      attachments: (msg.attachments ?? []).map((a, index) => ({ ...a, index }))
    }
  }

  async downloadAttachment(): Promise<{ filename: string; content: Buffer }> {
    throw new Error('Anhänge sind im Demo-Postfach nicht speicherbar.')
  }

  async attachmentData(): Promise<{ filename: string; contentType: string; base64: string }> {
    throw new Error('Anhänge sind im Demo-Postfach nicht verfügbar.')
  }

  async moveMessage(mailbox: string, uid: number, target: string): Promise<void> {
    const msg = this.data.messages.find((m) => m.mailbox === mailbox && m.uid === uid)
    if (!msg) return
    msg.mailbox = target.startsWith('\\')
      ? FOLDERS.find((f) => f.specialUse === target)?.path ?? 'Archive'
      : target
    this.persist()
  }

  async search(text: string): Promise<MessageSummary[]> {
    const q = text.trim().toLowerCase()
    if (!q) return []
    return this.data.messages
      .filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.fromName.toLowerCase().includes(q) ||
          m.fromAddress.toLowerCase().includes(q) ||
          m.text.toLowerCase().includes(q)
      )
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .map((m) => ({ ...this.toSummary(m), accountId: this.accountId, mailbox: m.mailbox }))
  }

  async saveDraft(): Promise<{ uid: number; mailbox: string }> {
    return { uid: 0, mailbox: 'Drafts' }
  }

  async markAllSeen(mailbox: string): Promise<void> {
    let changed = false
    for (const m of this.data.messages) {
      if (m.mailbox === mailbox && !m.seen) {
        m.seen = true
        changed = true
      }
    }
    if (changed) this.persist()
  }

  async setFlag(
    mailbox: string,
    uid: number,
    flag: '\\Seen' | '\\Flagged',
    value: boolean
  ): Promise<void> {
    const msg = this.data.messages.find((m) => m.mailbox === mailbox && m.uid === uid)
    if (!msg) return
    if (flag === '\\Seen') msg.seen = value
    else msg.flagged = value
    this.persist()
  }

  async deleteMessage(mailbox: string, uid: number): Promise<void> {
    const msg = this.data.messages.find((m) => m.mailbox === mailbox && m.uid === uid)
    if (!msg) return
    if (mailbox === 'Trash') {
      this.data.messages = this.data.messages.filter((m) => m !== msg)
    } else {
      msg.mailbox = 'Trash'
    }
    this.persist()
  }

  /** „Versendet" eine Demo-Mail: legt sie in Gesendet ab und schickt später eine Auto-Antwort. */
  async send(payload: ComposePayload): Promise<{ messageId: string }> {
    const uid = this.data.nextUid++
    this.data.messages.push({
      uid,
      mailbox: 'Sent',
      subject: payload.subject || '(kein Betreff)',
      fromName: 'Ich',
      fromAddress: 'du@demo.mailwave.app',
      to: payload.to.split(',').map((s) => s.trim()).filter(Boolean),
      cc: (payload.cc || '').split(',').map((s) => s.trim()).filter(Boolean),
      date: new Date().toISOString(),
      seen: true,
      flagged: false,
      html: null,
      text: payload.text,
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        contentType: a.contentType || 'application/octet-stream',
        size: Math.floor((a.contentBase64.length * 3) / 4)
      }))
    })
    this.persist()

    const t = setTimeout(() => {
      const replyUid = this.data.nextUid++
      const reply: DemoMessage = {
        uid: replyUid,
        mailbox: 'INBOX',
        subject: payload.subject.startsWith('Re:') ? payload.subject : `Re: ${payload.subject}`,
        fromName: 'Demo-Bot',
        fromAddress: payload.to.split(',')[0]?.trim() || 'bot@demo.mailwave.app',
        to: ['du@demo.mailwave.app'],
        cc: [],
        date: new Date().toISOString(),
        seen: false,
        flagged: false,
        html: null,
        text: `Automatische Antwort aus dem Demo-Postfach.\n\nDu hast geschrieben:\n${payload.text
          .split('\n')
          .map((l) => '> ' + l)
          .join('\n')}`
      }
      this.data.messages.push(reply)
      this.persist()
      this.bus.emit('newMail', {
        accountId: this.accountId,
        mailbox: 'INBOX',
        message: this.toSummary(reply)
      } as NewMailEvent)
    }, 6000)
    this.timers.push(t)

    return { messageId: `<demo-${uid}@mailwave.app>` }
  }
}

export function isDemoAccount(host: string | undefined): boolean {
  return host === 'demo'
}
