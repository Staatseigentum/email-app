export type AuthType = 'password' | 'oauth'
export type OAuthProvider = 'google' | 'microsoft'

export interface MailAccount {
  id: string
  label: string
  name: string
  email: string
  color: string
  imap: { host: string; port: number; secure: boolean }
  smtp: { host: string; port: number; secure: boolean }
  user: string
  authType: AuthType
  oauthProvider?: OAuthProvider
}

/** Wie ein Account beim Anlegen / Bearbeiten hereinkommt. */
export interface MailAccountInput
  extends Omit<MailAccount, 'id' | 'color' | 'authType' | 'oauthProvider'> {
  id?: string
  color?: string
  authType?: AuthType
  oauthProvider?: OAuthProvider
  /** Nur bei authType 'password'. Leer / '__keep__' = unverändert lassen. */
  password?: string
  /** Nur bei authType 'oauth': aus dem OAuth-Flow. */
  refreshToken?: string
}

export interface OAuthResult {
  provider: OAuthProvider
  email: string
  refreshToken: string
}

export interface OAuthClientConfig {
  google: { clientId: string; clientSecret: string; configured: boolean }
  microsoft: { clientId: string; configured: boolean }
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

export interface MessageAttachment {
  filename: string
  contentType: string
  size: number
  /** Index innerhalb der Nachricht – für „Anhang speichern". */
  index: number
}

export interface MessageDetail extends MessageSummary {
  html: string | null
  text: string | null
  cc: string[]
  attachments: MessageAttachment[]
}

export interface OutgoingAttachment {
  filename: string
  contentType: string
  /** Datei-Inhalt als Base64. */
  contentBase64: string
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
  attachments?: OutgoingAttachment[]
}

/** Wegwerf-Postfach (mail.tm) – öffentliche Felder ohne Geheimnisse. */
export interface TempMailbox {
  id: string
  address: string
  createdAt: string
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

export interface UpdateInfo {
  version: string
  notes: string
  url: string
  size: number
}

export type UpdateEvent =
  | { state: 'none' }
  | { state: 'available'; info: UpdateInfo }
  | { state: 'downloading'; info: UpdateInfo; progress: number }
  | { state: 'ready'; info: UpdateInfo }
  | { state: 'error'; message: string }
