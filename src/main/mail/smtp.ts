import nodemailer from 'nodemailer'
import { accountStore } from '../store'
import type { ComposePayload } from '../../shared/types'

export async function sendMail(payload: ComposePayload): Promise<{ messageId: string }> {
  const acc = accountStore.get(payload.accountId)
  if (!acc) throw new Error('Konto nicht gefunden')

  const transporter = nodemailer.createTransport({
    host: acc.smtp.host,
    port: acc.smtp.port,
    secure: acc.smtp.secure,
    auth: { user: acc.user, pass: accountStore.password(payload.accountId) }
  })

  const info = await transporter.sendMail({
    from: { name: acc.name, address: acc.email },
    to: payload.to,
    cc: payload.cc || undefined,
    bcc: payload.bcc || undefined,
    subject: payload.subject,
    text: payload.text,
    inReplyTo: payload.inReplyTo || undefined,
    references: payload.references || undefined
  })

  return { messageId: info.messageId }
}

export async function verifySmtp(opts: {
  smtp: { host: string; port: number; secure: boolean }
  user: string
  password: string
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: opts.smtp.host,
    port: opts.smtp.port,
    secure: opts.smtp.secure,
    auth: { user: opts.user, pass: opts.password }
  })
  await transporter.verify()
}
