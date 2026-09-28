import { app, BrowserWindow, clipboard, dialog, ipcMain, Notification, shell } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { IPC } from '../shared/ipc'
import { extractOneTimeCode } from '../shared/oneTimeCode'
import type {
  AppSettings,
  ComposePayload,
  DraftPayload,
  IpcResult,
  MailAccountInput,
  MessageSummary,
  NewMailEvent,
  OAuthProvider,
  SearchQuery
} from '../shared/types'
import { accountStore } from './store'
import { mailCache } from './mailCache'
import { settingsStore } from './settings'
import { mailManager } from './mail/manager'
import { testConnection } from './mail/imapClient'
import { buildMime, sendMail, verifySmtp } from './mail/smtp'
import { DemoConnection, isDemoAccount } from './mail/demo'
import { TempMailService } from './mail/tempMail'
import { runOAuth } from './oauth'
import { oauthConfig, parseGoogleCredentials } from './oauthConfig'
import { notificationIconPath } from './assets'

export const tempMail = new TempMailService(mailManager)
const activeNotifications = new Set<Notification>()

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
  ipcMain.on(IPC.winMinimize, (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on(IPC.winMaximizeToggle, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(IPC.winClose, (e) => BrowserWindow.fromWebContents(e.sender)?.close())

  mailManager.on('status', (s) => broadcast(IPC.onStatus, s))
  mailManager.on('newMail', (evt: NewMailEvent) => {
    broadcast(IPC.onNewMail, evt)
    const isTemp = evt.accountId.startsWith('temp:')
    if (!isTemp) mailCache.addNew(evt.accountId, evt.mailbox, evt.message)
    const acc = isTemp ? undefined : accountStore.get(evt.accountId)
    const context = isTemp ? 'Wegwerf-Postfach' : acc?.label
    const notify = settingsStore.get().notify
    const allowed =
      notify === 'all' || (notify === 'inbox' && (isTemp || evt.mailbox === 'INBOX'))
    if (allowed && Notification.isSupported()) {
      const code = extractOneTimeCode(evt.message.subject, evt.message.snippet)
      const preview = evt.message.snippet
        ? `${evt.message.subject}\n${evt.message.snippet}`
        : evt.message.subject
      const icon = notificationIconPath()
      const n = new Notification({
        title: evt.message.fromName,
        body: code ? `${preview}\nCode ${code} · Klicken zum Kopieren` : preview,
        subtitle: context,
        silent: false,
        actions: code
          ? [{ type: 'button', text: 'Code kopieren' }]
          : isTemp
            ? []
            : [{ type: 'button', text: 'Antworten' }, { type: 'button', text: 'Archivieren' }],
        ...(icon ? { icon } : {})
      })
      activeNotifications.add(n)
      setTimeout(() => activeNotifications.delete(n), 10 * 60 * 1000).unref()
      const focusWin = (): BrowserWindow | undefined => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          if (win.isMinimized()) win.restore()
          win.focus()
        }
        return win
      }
      n.on('click', () => {
        activeNotifications.delete(n)
        if (code) clipboard.writeText(code)
        else focusWin()?.webContents.send(IPC.onNewMail, { ...evt, focus: true })
      })
      n.on('action', (_e, index) => {
        activeNotifications.delete(n)
        if (code) {
          if (index === 0) clipboard.writeText(code)
          return
        }
        if (index === 0) {
          focusWin()?.webContents.send(IPC.onNewMail, { ...evt, focus: true, reply: true })
        } else if (index === 1) {
          try {
            void mailManager
              .get(evt.accountId)
              .moveMessage(evt.mailbox, evt.message.uid, '\\Archive')
              .catch(() => {})
          } catch {
            /* Konto nicht mehr verbunden */
          }
        }
      })
      n.show()
    }
  })

  ipcMain.handle(IPC.accountsList, () => wrap(async () => accountStore.list()))

  ipcMain.handle(IPC.accountsSave, (_e, input: MailAccountInput) =>
    wrap(async () => {
      const saved = accountStore.save(input)
      mailCache.clearAccount(saved.id)
      await mailManager.restartAccount(saved.id)
      return saved
    })
  )

  ipcMain.handle(IPC.accountsDelete, (_e, id: string) =>
    wrap(async () => {
      await mailManager.stopAccount(id)
      accountStore.delete(id)
      mailCache.clearAccount(id)
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

  ipcMain.handle(IPC.cachedMailboxes, (_e, id: string) =>
    wrap(async () => (accountStore.get(id) ? mailCache.mailboxes(id) : null))
  )

  ipcMain.handle(IPC.cachedMessages, (_e, id: string, mailbox: string) =>
    wrap(async () => (accountStore.get(id) ? mailCache.messages(id, mailbox) : null))
  )

  ipcMain.handle(IPC.mailboxes, (_e, id: string) =>
    wrap(async () => {
      const boxes = await mailManager.get(id).listMailboxes()
      if (accountStore.get(id)) mailCache.saveMailboxes(id, boxes)
      return boxes
    })
  )

  ipcMain.handle(IPC.messages, (_e, id: string, mailbox: string, page: number) =>
    wrap(async () => {
      const messages = await mailManager.get(id).listMessages(mailbox, page)
      if (page === 0 && accountStore.get(id)) mailCache.saveMessages(id, mailbox, messages)
      return messages
    })
  )

  ipcMain.handle(IPC.message, (_e, id: string, mailbox: string, uid: number) =>
    wrap(() => mailManager.get(id).getMessage(mailbox, uid))
  )

  ipcMain.handle(IPC.markSeen, (_e, id: string, mailbox: string, uid: number, value: boolean) =>
    wrap(async () => {
      await mailManager.get(id).setFlag(mailbox, uid, '\\Seen', value)
      mailCache.setFlag(id, mailbox, uid, 'seen', value)
    })
  )

  ipcMain.handle(IPC.markAllSeen, (_e, id: string, mailbox: string) =>
    wrap(async () => {
      await mailManager.get(id).markAllSeen(mailbox)
      mailCache.markAllSeen(id, mailbox)
    })
  )

  ipcMain.handle(IPC.flag, (_e, id: string, mailbox: string, uid: number, value: boolean) =>
    wrap(async () => {
      await mailManager.get(id).setFlag(mailbox, uid, '\\Flagged', value)
      mailCache.setFlag(id, mailbox, uid, 'flagged', value)
    })
  )

  ipcMain.handle(IPC.deleteMessage, (_e, id: string, mailbox: string, uid: number) =>
    wrap(async () => {
      await mailManager.get(id).deleteMessage(mailbox, uid)
      mailCache.remove(id, mailbox, uid)
    })
  )

  ipcMain.handle(
    IPC.moveMessage,
    (_e, id: string, mailbox: string, uid: number, target: string) =>
      wrap(async () => {
        await mailManager.get(id).moveMessage(mailbox, uid, target)
        mailCache.remove(id, mailbox, uid)
        mailCache.invalidate(id, target)
      })
  )

  ipcMain.handle(IPC.search, (_e, q: SearchQuery) =>
    wrap(() => mailManager.get(q.accountId).search(q.text, q.scope, q.mailbox))
  )

  ipcMain.handle(IPC.unified, () =>
    wrap(async () => {
      const lists = await Promise.all(
        mailManager.entries().map(async ([id, conn]) => {
          try {
            const msgs = await conn.listMessages('INBOX', 0)
            mailCache.saveMessages(id, 'INBOX', msgs)
            return msgs.map((m) => ({ ...m, accountId: id, mailbox: 'INBOX' }))
          } catch {
            return [] as MessageSummary[]
          }
        })
      )
      return lists
        .flat()
        .sort((a, b) => +new Date(b.date) - +new Date(a.date))
        .slice(0, 120)
    })
  )

  ipcMain.handle(IPC.cachedUnified, () =>
    wrap(async () =>
      accountStore.list()
        .flatMap((acc) =>
          (mailCache.messages(acc.id, 'INBOX') ?? []).map((m) => ({
            ...m,
            accountId: acc.id,
            mailbox: 'INBOX'
          }))
        )
        .sort((a, b) => +new Date(b.date) - +new Date(a.date))
        .slice(0, 120)
    )
  )

  ipcMain.handle(IPC.saveDraft, (_e, payload: DraftPayload) =>
    wrap(async () => {
      const mime = await buildMime(payload)
      const saved = await mailManager.get(payload.accountId).saveDraft(mime, payload.replaceUid)
      mailCache.invalidate(payload.accountId, saved.mailbox)
      return saved
    })
  )

  ipcMain.handle(
    IPC.attachmentData,
    (_e, id: string, mailbox: string, uid: number, index: number) =>
      wrap(() => mailManager.get(id).attachmentData(mailbox, uid, index))
  )

  ipcMain.handle(IPC.appVersion, () => wrap(async () => app.getVersion()))
  ipcMain.handle(IPC.copyCode, (_e, code: string) =>
    wrap(async () => {
      if (typeof code !== 'string' || !/^\d{4,8}$/.test(code)) {
        throw new Error('Ungültiger Einmalcode')
      }
      clipboard.writeText(code)
      return true
    })
  )

  ipcMain.handle(IPC.settingsGet, () => wrap(async () => settingsStore.get()))
  ipcMain.handle(IPC.settingsSet, (_e, patch: Partial<AppSettings>) =>
    wrap(async () => settingsStore.set(patch))
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
