import { app, safeStorage } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { TempMailbox } from '../shared/types'

/** Ein bei mail.tm angelegtes Wegwerf-Postfach. */
interface StoredTempMailbox {
  id: string
  /** mail.tm-Account-ID (für DELETE /accounts/{id}). */
  accountId: string
  address: string
  createdAt: string
  /** Base64 des via safeStorage verschlüsselten Passworts. */
  password: string
  /** Base64 des via safeStorage verschlüsselten Bearer-Tokens. */
  token: string
}

function encrypt(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64')
  }
  return 'plain:' + Buffer.from(value, 'utf-8').toString('base64')
}

function decrypt(secret: string): string {
  if (!secret) return ''
  if (secret.startsWith('plain:')) {
    return Buffer.from(secret.slice(6), 'base64').toString('utf-8')
  }
  return safeStorage.decryptString(Buffer.from(secret, 'base64'))
}

function dataFile(): string {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'temp-mailboxes.json')
}

function readAll(): StoredTempMailbox[] {
  const file = dataFile()
  if (!existsSync(file)) return []
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as StoredTempMailbox[]
  } catch {
    return []
  }
}

function writeAll(list: StoredTempMailbox[]): void {
  writeFileSync(dataFile(), JSON.stringify(list, null, 2), 'utf-8')
}

function toPublic(m: StoredTempMailbox): TempMailbox {
  return { id: m.id, address: m.address, createdAt: m.createdAt }
}

export interface TempSecrets {
  accountId: string
  address: string
  password: string
  token: string
}

export const tempStore = {
  list(): TempMailbox[] {
    return readAll()
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map(toPublic)
  },

  add(input: { accountId: string; address: string; password: string; token: string }): TempMailbox {
    const all = readAll()
    const record: StoredTempMailbox = {
      id: randomUUID(),
      accountId: input.accountId,
      address: input.address,
      createdAt: new Date().toISOString(),
      password: encrypt(input.password),
      token: encrypt(input.token)
    }
    all.push(record)
    writeAll(all)
    return toPublic(record)
  },

  secrets(id: string): TempSecrets {
    const found = readAll().find((m) => m.id === id)
    if (!found) throw new Error('Wegwerf-Postfach nicht gefunden')
    return {
      accountId: found.accountId,
      address: found.address,
      password: decrypt(found.password),
      token: decrypt(found.token)
    }
  },

  updateToken(id: string, token: string): void {
    const all = readAll()
    const idx = all.findIndex((m) => m.id === id)
    if (idx < 0) return
    all[idx].token = encrypt(token)
    writeAll(all)
  },

  remove(id: string): void {
    writeAll(readAll().filter((m) => m.id !== id))
  }
}
