import { shell } from 'electron'
import { createServer } from 'http'
import { createHash, randomBytes } from 'crypto'
import { oauthConfig } from './oauthConfig'
import { accountStore } from './store'
import type { OAuthProvider, OAuthResult } from '../shared/types'

interface ProviderMeta {
  authUrl: string
  tokenUrl: string
  scope: string
  redirectHost: string
  needsSecret: boolean
}

const META: Record<OAuthProvider, ProviderMeta> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://mail.google.com/ openid email',
    redirectHost: '127.0.0.1',
    needsSecret: true
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope:
      'openid email offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send',
    redirectHost: 'localhost',
    needsSecret: false
  }
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function resultPage(title: string, ok: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;background:#0b0f1a;color:#e2e8f0;text-align:center;padding-top:14vh">
<div style="font-size:44px">${ok ? '✅' : '⚠️'}</div>
<h2>${title}</h2>
<p style="color:#94a3b8">Du kannst dieses Fenster schließen und zu MailWave zurückkehren.</p>
</body></html>`
}

interface Loopback {
  port: number
  waitForCode: () => Promise<string>
}

function startLoopback(expectedState: string): Promise<Loopback> {
  return new Promise((ready, readyFail) => {
    let resolveCode!: (c: string) => void
    let rejectCode!: (e: Error) => void
    const codePromise = new Promise<string>((res, rej) => {
      resolveCode = res
      rejectCode = rej
    })

    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1')
        if (url.pathname !== '/callback') {
          res.writeHead(404)
          res.end()
          return
        }
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const error = url.searchParams.get('error_description') || url.searchParams.get('error')
        const ok = !error && !!code && state === expectedState
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(resultPage(ok ? 'Anmeldung erfolgreich' : 'Anmeldung fehlgeschlagen', ok))
        server.close()
        if (ok) resolveCode(code as string)
        else if ((error || '').includes('access_denied')) {
          rejectCode(
            new Error(
              'Google/Microsoft hat den Zugriff blockiert (access_denied). Meist steht das OAuth-Projekt auf „Testing" und deine Adresse ist kein Testnutzer – oder die App muss „veröffentlicht/In Produktion" gesetzt werden. Siehe docs/OAUTH-SETUP.md.'
            )
          )
        } else rejectCode(new Error(error || 'Ungültige Antwort vom Anmeldedienst'))
      } catch (e) {
        rejectCode(e as Error)
      }
    })

    server.on('error', readyFail)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      const timeout = setTimeout(
        () => {
          server.close()
          rejectCode(new Error('Zeitüberschreitung – Anmeldung nicht abgeschlossen'))
        },
        5 * 60_000
      )
      ready({
        port,
        waitForCode: () =>
          codePromise.finally(() => {
            clearTimeout(timeout)
          })
      })
    })
  })
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  id_token?: string
  error?: string
  error_description?: string
}

async function tokenRequest(
  provider: OAuthProvider,
  params: Record<string, string>
): Promise<TokenResponse> {
  const res = await fetch(META[provider].tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  })
  const json = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `Token-Fehler (${res.status})`)
  }
  return json
}

function clientCreds(provider: OAuthProvider): { clientId: string; clientSecret: string } {
  const s = oauthConfig.secrets()
  if (provider === 'google') return s.google
  return { clientId: s.microsoft.clientId, clientSecret: '' }
}

function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf-8'))
    return payload.email || payload.preferred_username || payload.upn || null
  } catch {
    return null
  }
}

/** Interaktiver Login: öffnet den Standardbrowser, fängt den Callback ab, tauscht den Code. */
export async function runOAuth(provider: OAuthProvider): Promise<OAuthResult> {
  const { clientId, clientSecret } = clientCreds(provider)
  if (!clientId) throw new Error('Für diesen Anbieter ist noch keine OAuth-Client-ID hinterlegt.')
  if (META[provider].needsSecret && !clientSecret) {
    throw new Error('Es fehlt das OAuth-Client-Secret für diesen Anbieter.')
  }

  const meta = META[provider]
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(16))

  const { port, waitForCode } = await startLoopback(state)
  const redirectUri = `http://${meta.redirectHost}:${port}/callback`

  const authUrl = new URL(meta.authUrl)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', meta.scope)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)
  if (provider === 'google') {
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
  }

  await shell.openExternal(authUrl.toString())
  const code = await waitForCode()

  const params: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier
  }
  if (provider === 'google') params.client_secret = clientSecret
  if (provider === 'microsoft') params.scope = meta.scope

  const tokens = await tokenRequest(provider, params)
  if (!tokens.refresh_token) {
    throw new Error(
      'Kein Refresh-Token erhalten. Bitte erneut anmelden und den Zugriff bestätigen.'
    )
  }
  const email = emailFromIdToken(tokens.id_token)
  if (!email) throw new Error('E-Mail-Adresse konnte nicht ermittelt werden.')

  return { provider, email, refreshToken: tokens.refresh_token }
}

const accessCache = new Map<string, { token: string; expiresAt: number }>()

/** Liefert ein gültiges Access-Token für ein Konto (erneuert bei Bedarf über den Refresh-Token). */
export async function getAccessToken(accountId: string): Promise<string> {
  const cached = accessCache.get(accountId)
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token

  const acc = accountStore.get(accountId)
  if (!acc || acc.authType !== 'oauth' || !acc.oauthProvider) {
    throw new Error('Kein OAuth-Konto')
  }
  const provider = acc.oauthProvider
  const { clientId, clientSecret } = clientCreds(provider)
  const refreshToken = accountStore.password(accountId) // hier: Refresh-Token

  const params: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId
  }
  if (provider === 'google') params.client_secret = clientSecret
  if (provider === 'microsoft') params.scope = META.microsoft.scope

  const tokens = await tokenRequest(provider, params)
  const expiresAt = Date.now() + (tokens.expires_in ?? 3600) * 1000
  accessCache.set(accountId, { token: tokens.access_token, expiresAt })
  if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
    accountStore.updateSecret(accountId, tokens.refresh_token)
  }
  return tokens.access_token
}

export function invalidateAccessToken(accountId: string): void {
  accessCache.delete(accountId)
}

export function oauthImapHost(provider: OAuthProvider): {
  imap: { host: string; port: number; secure: boolean }
  smtp: { host: string; port: number; secure: boolean }
} {
  return provider === 'google'
    ? {
        imap: { host: 'imap.gmail.com', port: 993, secure: true },
        smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
      }
    : {
        imap: { host: 'outlook.office365.com', port: 993, secure: true },
        smtp: { host: 'smtp.office365.com', port: 587, secure: false }
      }
}
