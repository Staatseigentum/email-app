import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  ComposePayload,
  ConnectionStatus,
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
    saveAttachment: (
      id: string,
      mailbox: string,
      uid: number,
      index: number
    ): Promise<IpcResult<{ saved: boolean; path?: string }>> =>
      ipcRenderer.invoke(IPC.saveAttachment, id, mailbox, uid, index),
    send: (payload: ComposePayload): Promise<IpcResult<{ messageId: string }>> =>
      ipcRenderer.invoke(IPC.send, payload),
    sync: (id: string): Promise<IpcResult<boolean>> => ipcRenderer.invoke(IPC.sync, id)
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
  onNewMail: (cb: (e: NewMailEvent & { focus?: boolean }) => void): (() => void) => {
    const handler = (_e: unknown, evt: NewMailEvent): void => cb(evt)
    ipcRenderer.on(IPC.onNewMail, handler)
    return () => ipcRenderer.removeListener(IPC.onNewMail, handler)
  }
}

contextBridge.exposeInMainWorld('mailwave', api)

export type MailwaveApi = typeof api
