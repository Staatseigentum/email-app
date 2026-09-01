import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../shared/types'

const DEFAULTS: AppSettings = {
  undoSendSeconds: 5,
  blockRemoteContent: true,
  notify: 'all',
  signatures: {},
  remoteAllow: []
}

function file(): string {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'settings.json')
}

let cache: AppSettings | null = null

function read(): AppSettings {
  if (cache) return cache
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf-8')) as Partial<AppSettings>
      cache = { ...DEFAULTS, ...raw, signatures: { ...raw.signatures } }
    } else {
      cache = { ...DEFAULTS }
    }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache
}

export const settingsStore = {
  get(): AppSettings {
    return read()
  },

  set(patch: Partial<AppSettings>): AppSettings {
    const next: AppSettings = { ...read(), ...patch }
    if (patch.signatures) next.signatures = { ...read().signatures, ...patch.signatures }
    cache = next
    writeFileSync(file(), JSON.stringify(next, null, 2), 'utf-8')
    return next
  },

  /** true, wenn externe Inhalte für diesen Absender geladen werden dürfen. */
  remoteAllowed(fromAddress: string): boolean {
    const s = read()
    if (!s.blockRemoteContent) return true
    const addr = fromAddress.toLowerCase()
    const domain = addr.split('@')[1] ?? ''
    return s.remoteAllow.some((e) => {
      const t = e.toLowerCase()
      return t === addr || t === domain
    })
  }
}
