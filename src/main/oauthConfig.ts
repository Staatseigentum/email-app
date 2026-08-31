import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { OAuthClientConfig } from '../shared/types'

interface StoredConfig {
  googleClientId?: string
  googleSecret?: string // safeStorage, base64
  microsoftClientId?: string
}

function file(): string {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'oauth.json')
}

function read(): StoredConfig {
  try {
    if (existsSync(file())) return JSON.parse(readFileSync(file(), 'utf-8'))
  } catch {
    /* ignore */
  }
  return {}
}

function enc(v: string): string {
  if (!v) return ''
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(v).toString('base64')
    : 'plain:' + Buffer.from(v).toString('base64')
}

function dec(v: string | undefined): string {
  if (!v) return ''
  if (v.startsWith('plain:')) return Buffer.from(v.slice(6), 'base64').toString('utf-8')
  return safeStorage.decryptString(Buffer.from(v, 'base64'))
}

export const oauthConfig = {
  /** Interne Credentials (mit Secret im Klartext) für den OAuth-Flow. */
  secrets(): { google: { clientId: string; clientSecret: string }; microsoft: { clientId: string } } {
    const c = read()
    return {
      google: { clientId: c.googleClientId ?? '', clientSecret: dec(c.googleSecret) },
      microsoft: { clientId: c.microsoftClientId ?? '' }
    }
  },

  /** Für den Renderer – ohne Secret, nur ob konfiguriert. */
  public(): OAuthClientConfig {
    const c = read()
    return {
      google: {
        clientId: c.googleClientId ?? '',
        clientSecret: c.googleSecret ? '••••••••' : '',
        configured: Boolean(c.googleClientId && c.googleSecret)
      },
      microsoft: {
        clientId: c.microsoftClientId ?? '',
        configured: Boolean(c.microsoftClientId)
      }
    }
  },

  set(input: {
    googleClientId?: string
    googleClientSecret?: string
    microsoftClientId?: string
  }): OAuthClientConfig {
    const c = read()
    if (input.googleClientId !== undefined) c.googleClientId = input.googleClientId.trim()
    if (input.googleClientSecret !== undefined && input.googleClientSecret !== '••••••••') {
      c.googleSecret = input.googleClientSecret ? enc(input.googleClientSecret.trim()) : undefined
    }
    if (input.microsoftClientId !== undefined) c.microsoftClientId = input.microsoftClientId.trim()
    writeFileSync(file(), JSON.stringify(c, null, 2), 'utf-8')
    return this.public()
  }
}
