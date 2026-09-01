import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  AppSettings,
  ComposePayload,
  ConnectionStatus,
  DraftPayload,
  DraftSaved,
  IpcResult,
  MailAccount,
  MailAccountInput,
  MailboxNode,
  MessageDetail,
  MessageSummary,
  NewMailEvent,
  OAuthClientConfig,
  OAuthProvider,
  OAuthResult,
  SearchQuery,
  TempMailbox,
  UpdateEvent,
  UpdateInfo
} from '../shared/types'

const api = {
  accounts: {
    list: (): Promise<IpcResult<MailAccount[]>> => ipcRenderer.invoke(IPC.accountsList),
    save: (input: MailAccountInput): Promise<IpcResult<MailAccount>> =>
      ipcRenderer.invoke(IPC.accountsSave, input),
    delete: (id: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.accountsDelete, id),
    test: (input: MailAccountInput): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.accountsTest, input)
  },
  mail: {
    mailboxes: (id: string): Promise<IpcResult<MailboxNode[]>> =>
      ipcRenderer.invoke(IPC.mailboxes, id),
    messages: (id: string, mailbox: string, page = 0): Promise<IpcResult<MessageSummary[]>> =>
      ipcRenderer.invoke(IPC.messages, id, mailbox, page),
    message: (id: string, mailbox: string, uid: number): Promise<IpcResult<MessageDetail>> =>
      ipcRenderer.invoke(IPC.message, id, mailbox, uid),
    markSeen: (id: string, mailbox: string, uid: number, value: boolean): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.markSeen, id, mailbox, uid, value),
    markAllSeen: (id: string, mailbox: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.markAllSeen, id, mailbox),
    flag: (id: string, mailbox: string, uid: number, value: boolean): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.flag, id, mailbox, uid, value),
    remove: (id: string, mailbox: string, uid: number): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.deleteMessage, id, mailbox, uid),
    move: (id: string, mailbox: string, uid: number, target: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.moveMessage, id, mailbox, uid, target),
    saveAttachment: (
      id: string,
      mailbox: string,
      uid: number,
      index: number
    ): Promise<IpcResult<{ saved: boolean; path?: string }>> =>
      ipcRenderer.invoke(IPC.saveAttachment, id, mailbox, uid, index),
    attachmentData: (
      id: string,
      mailbox: string,
      uid: number,
      index: number
    ): Promise<IpcResult<{ filename: string; contentType: string; base64: string }>> =>
      ipcRenderer.invoke(IPC.attachmentData, id, mailbox, uid, index),
    send: (payload: ComposePayload): Promise<IpcResult<{ messageId: string }>> =>
      ipcRenderer.invoke(IPC.send, payload),
    saveDraft: (payload: DraftPayload): Promise<IpcResult<DraftSaved>> =>
      ipcRenderer.invoke(IPC.saveDraft, payload),
    search: (q: SearchQuery): Promise<IpcResult<MessageSummary[]>> =>
      ipcRenderer.invoke(IPC.search, q),
    unified: (): Promise<IpcResult<MessageSummary[]>> => ipcRenderer.invoke(IPC.unified),
    sync: (id: string): Promise<IpcResult<boolean>> => ipcRenderer.invoke(IPC.sync, id)
  },
  settings: {
    get: (): Promise<IpcResult<AppSettings>> => ipcRenderer.invoke(IPC.settingsGet),
    set: (patch: Partial<AppSettings>): Promise<IpcResult<AppSettings>> =>
      ipcRenderer.invoke(IPC.settingsSet, patch)
  },
  temp: {
    list: (): Promise<IpcResult<TempMailbox[]>> => ipcRenderer.invoke(IPC.tempList),
    create: (): Promise<IpcResult<TempMailbox>> => ipcRenderer.invoke(IPC.tempCreate),
    remove: (id: string): Promise<IpcResult<boolean>> => ipcRenderer.invoke(IPC.tempRemove, id),
    activate: (id: string | null): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.tempActivate, id),
    messages: (id: string): Promise<IpcResult<MessageSummary[]>> =>
      ipcRenderer.invoke(IPC.tempMessages, id),
    message: (id: string, uid: number): Promise<IpcResult<MessageDetail>> =>
      ipcRenderer.invoke(IPC.tempMessage, id, uid),
    markAllSeen: (id: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.tempMarkAllSeen, id),
    saveAttachment: (
      id: string,
      uid: number,
      index: number
    ): Promise<IpcResult<{ saved: boolean; path?: string }>> =>
      ipcRenderer.invoke(IPC.tempSaveAttachment, id, uid, index)
  },
  openExternal: (url: string): Promise<IpcResult<boolean>> =>
    ipcRenderer.invoke(IPC.openExternal, url),
  appVersion: (): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.appVersion),
  oauth: {
    start: (provider: OAuthProvider): Promise<IpcResult<OAuthResult>> =>
      ipcRenderer.invoke(IPC.oauthStart, provider),
    getConfig: (): Promise<IpcResult<OAuthClientConfig>> =>
      ipcRenderer.invoke(IPC.oauthConfigGet),
    setConfig: (input: {
      googleClientId?: string
      googleClientSecret?: string
      microsoftClientId?: string
    }): Promise<IpcResult<OAuthClientConfig>> => ipcRenderer.invoke(IPC.oauthConfigSet, input),
    importGoogle: (): Promise<IpcResult<OAuthClientConfig>> =>
      ipcRenderer.invoke(IPC.oauthImportGoogle)
  },
  win: {
    minimize: (): void => ipcRenderer.send(IPC.winMinimize),
    maximizeToggle: (): void => ipcRenderer.send(IPC.winMaximizeToggle),
    close: (): void => ipcRenderer.send(IPC.winClose)
  },
  update: {
    check: (): Promise<UpdateInfo | null> => ipcRenderer.invoke(IPC.updateCheck),
    apply: (): Promise<void> => ipcRenderer.invoke(IPC.updateApply),
    on: (cb: (e: UpdateEvent) => void): (() => void) => {
      const handler = (_e: unknown, evt: UpdateEvent): void => cb(evt)
      ipcRenderer.on(IPC.onUpdate, handler)
      return () => ipcRenderer.removeListener(IPC.onUpdate, handler)
    }
  },
  onStatus: (cb: (s: ConnectionStatus) => void): (() => void) => {
    const handler = (_e: unknown, s: ConnectionStatus): void => cb(s)
    ipcRenderer.on(IPC.onStatus, handler)
    return () => ipcRenderer.removeListener(IPC.onStatus, handler)
  },
  onNewMail: (
    cb: (e: NewMailEvent & { focus?: boolean; reply?: boolean }) => void
  ): (() => void) => {
    const handler = (_e: unknown, evt: NewMailEvent): void => cb(evt)
    ipcRenderer.on(IPC.onNewMail, handler)
    return () => ipcRenderer.removeListener(IPC.onNewMail, handler)
  }
}

contextBridge.exposeInMainWorld('mailwave', api)

export type MailwaveApi = typeof api
