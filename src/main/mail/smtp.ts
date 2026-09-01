import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import type Mail from 'nodemailer/lib/mailer'
import { accountStore } from '../store'
import { getAccessToken } from '../oauth'
import type { ComposePayload, MailAccount } from '../../shared/types'

function mailOptions(payload: ComposePayload, acc: MailAccount): Mail.Options {
  return {
    from: { name: acc.name, address: acc.email },
    to: payload.to || undefined,
    cc: payload.cc || undefined,
    bcc: payload.bcc || undefined,
    subject: payload.subject,
    text: payload.text,
    inReplyTo: payload.inReplyTo || undefined,
    references: payload.references || undefined,
    attachments: payload.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64, 'base64'),
      contentType: a.contentType || undefined
    }))
  }
}

async function transportAuth(acc: MailAccount): Promise<SMTPTransport.Options['auth']> {
  return acc.authType === 'oauth'
    ? {
        type: 'OAuth2' as const,
        user: acc.email,
        accessToken: await getAccessToken(acc.id)
      }
    : { user: acc.user, pass: accountStore.password(acc.id) }
}

export async function sendMail(payload: ComposePayload): Promise<{ messageId: string }> {
  const acc = accountStore.get(payload.accountId)
  if (!acc) throw new Error('Konto nicht gefunden')

  const transporter = nodemailer.createTransport({
    host: acc.smtp.host,
    port: acc.smtp.port,
    secure: acc.smtp.secure,
    auth: await transportAuth(acc)
  })

  const info = await transporter.sendMail(mailOptions(payload, acc))
  return { messageId: info.messageId }
}

/** Baut die fertige MIME-Nachricht, ohne sie zu versenden (für „Entwurf speichern"). */
export async function buildMime(payload: ComposePayload): Promise<Buffer> {
  const acc = accountStore.get(payload.accountId)
  if (!acc) throw new Error('Konto nicht gefunden')
  const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true })
  const info = await transporter.sendMail(mailOptions(payload, acc))
  return info.message as Buffer
}

export async function verifySmtp(opts: {
  smtp: { host: string; port: number; secure: boolean }
  user: string
  password: string
}): Promise<void> {
  if (!opts.smtp.host) throw new Error('SMTP-Server fehlt')
  const transporter = nodemailer.createTransport({
    host: opts.smtp.host,
    port: opts.smtp.port,
    secure: opts.smtp.secure,
    auth: { user: opts.user, pass: opts.password },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  })
  try {
    await transporter.verify()
  } catch (err) {
    throw new Error(`SMTP (${opts.smtp.host}:${opts.smtp.port}): ${(err as Error).message}`)
  } finally {
    transporter.close()
  }
}
