import { BrowserWindow, dialog, ipcMain, Notification, shell } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { IPC } from '../shared/ipc'
import type {
  ComposePayload,
  IpcResult,
  MailAccountInput,
  NewMailEvent,
  OAuthProvider
} from '../shared/types'
import { accountStore } from './store'
import { mailManager } from './mail/manager'
import { testConnection } from './mail/imapClient'
import { sendMail, verifySmtp } from './mail/smtp'
import { DemoConnection, isDemoAccount } from './mail/demo'
import { TempMailService } from './mail/tempMail'
import { runOAuth } from './oauth'
import { oauthConfig, parseGoogleCredentials } from './oauthConfig'
import { notificationIconPath } from './assets'

export const tempMail = new TempMailService(mailManager)

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

async function saveBufferWithDialog(
  e: Electron.IpcMainInvokeEvent,
  filename: string,
  content: Buffer
): Promise<{ saved: boolean; path?: string }> {
  const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
  const picked = await dialog.showSaveDialog(win as BrowserWindow, {
    title: 'Anhang speichern',
    defaultPath: filename
  })
  if (picked.canceled || !picked.filePath) return { saved: false }
  writeFileSync(picked.filePath, content)
  return { saved: true, path: picked.filePath }
}

export function registerIpc(): void {
  mailManager.on('status', (s) => broadcast(IPC.onStatus, s))
  mailManager.on('newMail', (evt: NewMailEvent) => {
    broadcast(IPC.onNewMail, evt)
    const isTemp = evt.accountId.startsWith('temp:')
    const acc = isTemp ? undefined : accountStore.get(evt.accountId)
    const context = isTemp ? 'Wegwerf-Postfach' : acc?.label
    if (Notification.isSupported()) {
      const preview = evt.message.snippet
        ? `${evt.message.subject}\n${evt.message.snippet}`
        : evt.message.subject
      const icon = notificationIconPath()
      const n = new Notification({
        title: evt.message.fromName,
        body: preview,
        subtitle: context,
        silent: false,
        ...(icon ? { icon } : {})
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
      if (isDemoAccount(input.imap.host) || input.authType === 'oauth') return true
      await testConnection({
        imap: input.imap,
        user: input.user,
        password: input.password ?? ''
      })
      await verifySmtp({ smtp: input.smtp, user: input.user, password: input.password ?? '' })
      return true
    })
  )

  ipcMain.handle(IPC.oauthConfigGet, () => wrap(async () => oauthConfig.public()))

  ipcMain.handle(
    IPC.oauthConfigSet,
    (_e, input: Parameters<typeof oauthConfig.set>[0]) =>
      wrap(async () => oauthConfig.set(input))
  )

  ipcMain.handle(IPC.oauthStart, (_e, provider: OAuthProvider) =>
    wrap(() => runOAuth(provider))
  )

  ipcMain.handle(IPC.oauthImportGoogle, (e) =>
    wrap(async () => {
      const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
      const picked = await dialog.showOpenDialog(win as BrowserWindow, {
        title: 'Google credentials.json wählen',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
      })
      if (picked.canceled || !picked.filePaths[0]) return oauthConfig.public()
      const creds = parseGoogleCredentials(readFileSync(picked.filePaths[0], 'utf-8'))
      return oauthConfig.set({
        googleClientId: creds.clientId,
        googleClientSecret: creds.clientSecret
      })
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

  ipcMain.handle(IPC.markAllSeen, (_e, id: string, mailbox: string) =>
    wrap(() => mailManager.get(id).markAllSeen(mailbox))
  )

  ipcMain.handle(IPC.flag, (_e, id: string, mailbox: string, uid: number, value: boolean) =>
    wrap(() => mailManager.get(id).setFlag(mailbox, uid, '\\Flagged', value))
  )

  ipcMain.handle(IPC.deleteMessage, (_e, id: string, mailbox: string, uid: number) =>
    wrap(() => mailManager.get(id).deleteMessage(mailbox, uid))
  )

  ipcMain.handle(
    IPC.saveAttachment,
    (e, id: string, mailbox: string, uid: number, index: number) =>
      wrap(async () => {
        const { filename, content } = await mailManager
          .get(id)
          .downloadAttachment(mailbox, uid, index)
        return saveBufferWithDialog(e, filename, content)
      })
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

  // ---- Wegwerf-Postfach (mail.tm) ----
  ipcMain.handle(IPC.tempList, () => wrap(async () => tempMail.list()))
  ipcMain.handle(IPC.tempCreate, () => wrap(() => tempMail.create()))
  ipcMain.handle(IPC.tempRemove, (_e, id: string) => wrap(() => tempMail.remove(id)))
  ipcMain.handle(IPC.tempActivate, (_e, id: string | null) =>
    wrap(async () => {
      tempMail.setActive(id)
      return true
    })
  )
  ipcMain.handle(IPC.tempMessages, (_e, id: string) => wrap(() => tempMail.messages(id)))
  ipcMain.handle(IPC.tempMessage, (_e, id: string, uid: number) =>
    wrap(() => tempMail.message(id, uid))
  )
  ipcMain.handle(IPC.tempMarkAllSeen, (_e, id: string) => wrap(() => tempMail.markAllSeen(id)))
  ipcMain.handle(IPC.tempSaveAttachment, (e, id: string, uid: number, index: number) =>
    wrap(async () => {
      const { filename, content } = await tempMail.downloadAttachment(id, uid, index)
      return saveBufferWithDialog(e, filename, content)
    })
  )
}
