import { BrowserWindow, ipcMain, Notification, shell } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  ComposePayload,
  IpcResult,
  MailAccountInput,
  NewMailEvent
} from '../shared/types'
import { accountStore } from './store'
import { mailManager } from './mail/manager'
import { testConnection } from './mail/imapClient'
import { sendMail, verifySmtp } from './mail/smtp'
import { DemoConnection, isDemoAccount } from './mail/demo'

async function wrap<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    console.error('[ipc] Fehler:', err)
    return { ok: false, error: (err as Error).message || String(err) }
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function registerIpc(): void {
  mailManager.on('status', (s) => broadcast(IPC.onStatus, s))
  mailManager.on('newMail', (evt: NewMailEvent) => {
    broadcast(IPC.onNewMail, evt)
    const acc = accountStore.get(evt.accountId)
    if (Notification.isSupported()) {
      const n = new Notification({
        title: `${evt.message.fromName}`,
        body: evt.message.subject,
        subtitle: acc?.label
      })
      n.on('click', () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          if (win.isMinimized()) win.restore()
          win.focus()
          win.webContents.send(IPC.onNewMail, { ...evt, focus: true })
        }
      })
      n.show()
    }
  })

  ipcMain.handle(IPC.accountsList, () => wrap(async () => accountStore.list()))

  ipcMain.handle(IPC.accountsSave, (_e, input: MailAccountInput) =>
    wrap(async () => {
      const saved = accountStore.save(input)
      await mailManager.restartAccount(saved.id)
      return saved
    })
  )

  ipcMain.handle(IPC.accountsDelete, (_e, id: string) =>
    wrap(async () => {
      await mailManager.stopAccount(id)
      accountStore.delete(id)
      return true
    })
  )

  ipcMain.handle(IPC.accountsTest, (_e, input: MailAccountInput) =>
    wrap(async () => {
      if (isDemoAccount(input.imap.host)) return true
      await testConnection({ imap: input.imap, user: input.user, password: input.password })
      await verifySmtp({ smtp: input.smtp, user: input.user, password: input.password })
      return true
    })
  )

  ipcMain.handle(IPC.mailboxes, (_e, id: string) =>
    wrap(() => mailManager.get(id).listMailboxes())
  )

  ipcMain.handle(IPC.messages, (_e, id: string, mailbox: string, page: number) =>
    wrap(() => mailManager.get(id).listMessages(mailbox, page))
  )

  ipcMain.handle(IPC.message, (_e, id: string, mailbox: string, uid: number) =>
    wrap(() => mailManager.get(id).getMessage(mailbox, uid))
  )

  ipcMain.handle(IPC.markSeen, (_e, id: string, mailbox: string, uid: number, value: boolean) =>
    wrap(() => mailManager.get(id).setFlag(mailbox, uid, '\\Seen', value))
  )

  ipcMain.handle(IPC.flag, (_e, id: string, mailbox: string, uid: number, value: boolean) =>
    wrap(() => mailManager.get(id).setFlag(mailbox, uid, '\\Flagged', value))
  )

  ipcMain.handle(IPC.deleteMessage, (_e, id: string, mailbox: string, uid: number) =>
    wrap(() => mailManager.get(id).deleteMessage(mailbox, uid))
  )

  ipcMain.handle(IPC.send, (_e, payload: ComposePayload) =>
    wrap(async () => {
      const acc = accountStore.get(payload.accountId)
      if (acc && isDemoAccount(acc.imap.host)) {
        const conn = mailManager.get(payload.accountId)
        if (conn instanceof DemoConnection) return conn.send(payload)
      }
      return sendMail(payload)
    })
  )

  ipcMain.handle(IPC.sync, (_e, id: string) =>
    wrap(async () => {
      await mailManager.restartAccount(id)
      return true
    })
  )

  ipcMain.handle(IPC.openExternal, (_e, url: string) =>
    wrap(async () => {
      await shell.openExternal(url)
      return true
    })
  )
}
