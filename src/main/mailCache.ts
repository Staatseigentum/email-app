import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { MailboxNode, MessageSummary } from '../shared/types'

interface CachedAccount {
  mailboxes?: MailboxNode[]
  messages: Record<string, MessageSummary[]>
}

interface CacheFile {
  version: 1
  accounts: Record<string, CachedAccount>
}

const MAX_ACCOUNTS = 16
const MAX_MAILBOXES = 12
const PAGE_SIZE = 50
let data: CacheFile | null = null
let writeTimer: NodeJS.Timeout | null = null

function path(): string {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'mail-cache.bin')
}

function read(): CacheFile {
  if (data) return data
  data = { version: 1, accounts: {} }
  // Betreff, Absender und Vorschautexte gehören nicht unverschlüsselt auf die Platte.
  if (!safeStorage.isEncryptionAvailable()) return data
  try {
    if (existsSync(path())) {
      const parsed = JSON.parse(safeStorage.decryptString(readFileSync(path()))) as CacheFile
      if (parsed.version === 1 && parsed.accounts && typeof parsed.accounts === 'object') {
        data = parsed
      }
    }
  } catch (err) {
    console.warn('[mail-cache] Cache konnte nicht gelesen werden:', err)
  }
  return data
}

function flush(): void {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = null
  if (!data || !safeStorage.isEncryptionAvailable()) return
  try {
    const dest = path()
    const temp = `${dest}.tmp`
    writeFileSync(temp, safeStorage.encryptString(JSON.stringify(data)))
    renameSync(temp, dest)
  } catch (err) {
    console.warn('[mail-cache] Cache konnte nicht gespeichert werden:', err)
  }
}

function scheduleWrite(): void {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(flush, 250)
}

function account(id: string): CachedAccount {
  const cache = read()
  if (!cache.accounts[id] || !cache.accounts[id].messages) {
    cache.accounts[id] = { messages: {} }
  }
  return cache.accounts[id]
}

function patchMessages(id: string, mailbox: string, update: (list: MessageSummary[]) => MessageSummary[]): void {
  const list = read().accounts[id]?.messages?.[mailbox]
  if (!list) return
  account(id).messages[mailbox] = update(list)
  scheduleWrite()
}

export const mailCache = {
  mailboxes(id: string): MailboxNode[] | null {
    return read().accounts[id]?.mailboxes ?? null
  },
  messages(id: string, mailbox: string): MessageSummary[] | null {
    return read().accounts[id]?.messages?.[mailbox] ?? null
  },
  saveMailboxes(id: string, boxes: MailboxNode[]): void {
    account(id).mailboxes = boxes
    scheduleWrite()
  },
  saveMessages(id: string, mailbox: string, list: MessageSummary[]): void {
    const cache = account(id)
    delete cache.messages[mailbox]
    cache.messages[mailbox] = list.slice(0, PAGE_SIZE)
    const paths = Object.keys(cache.messages)
    if (paths.length > MAX_MAILBOXES) delete cache.messages[paths[0]]
    const ids = Object.keys(read().accounts)
    if (ids.length > MAX_ACCOUNTS) delete read().accounts[ids[0]]
    scheduleWrite()
  },
  addNew(id: string, mailbox: string, message: MessageSummary): void {
    patchMessages(id, mailbox, (list) =>
      [message, ...list.filter((m) => m.uid !== message.uid)].slice(0, PAGE_SIZE)
    )
  },
  setFlag(id: string, mailbox: string, uid: number, flag: 'seen' | 'flagged', value: boolean): void {
    patchMessages(id, mailbox, (list) =>
      list.map((m) => (m.uid === uid ? { ...m, [flag]: value } : m))
    )
  },
  markAllSeen(id: string, mailbox: string): void {
    patchMessages(id, mailbox, (list) => list.map((m) => ({ ...m, seen: true })))
  },
  remove(id: string, mailbox: string, uid: number): void {
    patchMessages(id, mailbox, (list) => list.filter((m) => m.uid !== uid))
  },
  invalidate(id: string, mailbox: string): void {
    const messages = read().accounts[id]?.messages
    if (messages && mailbox in messages) {
      delete messages[mailbox]
      scheduleWrite()
    }
  },
  clearAccount(id: string): void {
    delete read().accounts[id]
    scheduleWrite()
  },
  flush
}

app.on('before-quit', flush)
