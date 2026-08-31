export interface MailAccount {
  id: string
  label: string
  name: string
  email: string
  color: string
  imap: { host: string; port: number; secure: boolean }
  smtp: { host: string; port: number; secure: boolean }
  user: string
}

/** Wie ein Account beim Anlegen / Bearbeiten hereinkommt (inkl. Passwort). */
export interface MailAccountInput extends Omit<MailAccount, 'id' | 'color'> {
  id?: string
  color?: string
  password: string
}

export interface MailboxNode {
  path: string
  name: string
  specialUse?: string
  unseen: number
  total: number
}

export interface MessageSummary {
  uid: number
  seq: number
  subject: string
  fromName: string
  fromAddress: string
  to: string[]
  date: string
  seen: boolean
  flagged: boolean
  hasAttachments: boolean
  snippet: string
}

export interface MessageDetail extends MessageSummary {
  html: string | null
  text: string | null
  cc: string[]
  attachments: { filename: string; contentType: string; size: number }[]
}

export interface ComposePayload {
  accountId: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  text: string
  inReplyTo?: string
  references?: string
}

export interface ConnectionStatus {
  accountId: string
  state: 'connecting' | 'online' | 'offline' | 'error'
  message?: string
}

export interface NewMailEvent {
  accountId: string
  mailbox: string
  message: MessageSummary
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }
