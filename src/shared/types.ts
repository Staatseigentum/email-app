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
