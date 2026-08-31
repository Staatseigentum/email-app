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
  OAuthResult
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
    flag: (id: string, mailbox: string, uid: number, value: boolean): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.flag, id, mailbox, uid, value),
    remove: (id: string, mailbox: string, uid: number): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.deleteMessage, id, mailbox, uid),
    send: (payload: ComposePayload): Promise<IpcResult<{ messageId: string }>> =>
      ipcRenderer.invoke(IPC.send, payload),
    sync: (id: string): Promise<IpcResult<boolean>> => ipcRenderer.invoke(IPC.sync, id)
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
    }): Promise<IpcResult<OAuthClientConfig>> => ipcRenderer.invoke(IPC.oauthConfigSet, input)
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
