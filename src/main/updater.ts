import { app, BrowserWindow, ipcMain, net, shell } from 'electron'
import { spawn } from 'child_process'
import { createWriteStream, existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs'
import { readdir, rm } from 'fs/promises'
import { dirname, join } from 'path'
import { randomBytes } from 'crypto'
import { IPC } from '../shared/ipc'
import type { UpdateEvent, UpdateInfo } from '../shared/types'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const SETUP_ASSET = /^MailWave-Setup-.*\.exe$/i

const FALLBACK_REPO = 'Staatseigentum/email-app'

function repo(): string {
  // aus package.json (in der gepackten App unter resources/app/)
  try {
    const meta = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf-8'))
    return meta?.mailwave?.updateRepo || FALLBACK_REPO
  } catch {
    return FALLBACK_REPO
  }
}

function broadcast(evt: UpdateEvent): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.onUpdate, evt)
}

/** '1.2.10' > '1.2.9' – Vorabversionen (‑beta …) werden ignoriert. */
function isNewer(remote: string, local: string): boolean {
  const parse = (v: string): number[] =>
    v.replace(/^v/, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0)
  const a = parse(remote)
  const b = parse(local)
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true
    if ((a[i] || 0) < (b[i] || 0)) return false
  }
  return false
}

function getJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, redirect: 'follow' })
    req.setHeader('User-Agent', 'MailWave-Updater')
    req.setHeader('Accept', 'application/vnd.github+json')
    req.on('response', (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(Buffer.from(c)))
      res.on('end', () => {
        if ((res.statusCode || 0) >= 400) {
          reject(new Error(`GitHub API ${res.statusCode}`))
          return
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')))
        } catch (err) {
          reject(err as Error)
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function download(url: string, dest: string, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, redirect: 'follow' })
    req.setHeader('User-Agent', 'MailWave-Updater')
    req.setHeader('Accept', 'application/octet-stream')
    req.on('response', (res) => {
      if ((res.statusCode || 0) >= 400) {
        reject(new Error(`Download ${res.statusCode}`))
        return
      }
      const total = parseInt(String(res.headers['content-length'] || '0'), 10)
      let got = 0
      const file = createWriteStream(dest)
      res.on('data', (c) => {
        got += c.length
        file.write(Buffer.from(c))
        if (total && onProgress) onProgress(Math.round((got / total) * 100))
      })
      res.on('end', () => file.end(() => resolve()))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

let checking = false
let cached: UpdateInfo | null = null

export async function checkForUpdates(opts: { silent?: boolean } = {}): Promise<UpdateInfo | null> {
  if (checking) return cached
  checking = true
  try {
    const rel = await getJson(`https://api.github.com/repos/${repo()}/releases/latest`)
    const tag: string = rel?.tag_name || ''
    const asset = (rel?.assets || []).find((a: any) => SETUP_ASSET.test(a?.name || ''))
    if (!tag || !asset || !isNewer(tag, app.getVersion())) {
      cached = null
      if (!opts.silent) broadcast({ state: 'none' })
      return null
    }
    cached = {
      version: tag.replace(/^v/, ''),
      notes: (rel?.body || '').trim().slice(0, 2000),
      url: asset.browser_download_url,
      size: asset.size || 0
    }
    broadcast({ state: 'available', info: cached })
    return cached
  } catch (err) {
    if (!opts.silent) broadcast({ state: 'error', message: (err as Error).message })
    return null
  } finally {
    checking = false
  }
}

let applying = false

export async function applyUpdate(): Promise<void> {
  if (applying) return
  const info = cached
  if (!info) return
  applying = true

  const exeDir = dirname(app.getPath('exe'))
  const bootstrapSrc = join(exeDir, 'Updater.exe')

  // Ohne Bootstrap-Updater (z. B. Dev): einfach die Download-Seite öffnen.
  if (!existsSync(bootstrapSrc)) {
    await shell.openExternal(`https://github.com/${repo()}/releases/latest`)
    applying = false
    return
  }

  try {
    const tmp = join(app.getPath('temp'), `mailwave-update-${randomBytes(4).toString('hex')}`)
    mkdirSync(tmp, { recursive: true })
    const bootstrap = join(tmp, 'Updater.exe')
    copyFileSync(bootstrapSrc, bootstrap)

    const setup = join(tmp, `MailWave-Setup-${info.version}.exe`)
    broadcast({ state: 'downloading', info, progress: 0 })
    await download(info.url, setup, (pct) => broadcast({ state: 'downloading', info, progress: pct }))

    broadcast({ state: 'ready', info })

    const child = spawn(
      bootstrap,
      ['--setup', setup, '--wait', String(process.pid), '--launch', app.getPath('exe')],
      { detached: true, stdio: 'ignore' }
    )
    child.unref()

    setTimeout(() => app.quit(), 400)
  } catch (err) {
    applying = false
    broadcast({ state: 'error', message: (err as Error).message })
  }
}

export function initUpdater(): void {
  ipcMain.handle(IPC.updateCheck, () => checkForUpdates({ silent: false }))
  ipcMain.handle(IPC.updateApply, () => applyUpdate())

  if (!app.isPackaged || process.platform !== 'win32') return
  void cleanupUpdateTemp()
  setTimeout(() => void checkForUpdates({ silent: true }), 8000)
  setInterval(() => void checkForUpdates({ silent: true }), CHECK_INTERVAL_MS)
}

/** Aufräumen alter Update-Ordner aus dem Temp-Verzeichnis (best effort). */
export async function cleanupUpdateTemp(): Promise<void> {
  try {
    const tmp = app.getPath('temp')
    for (const name of await readdir(tmp)) {
      if (name.startsWith('mailwave-update-')) {
        await rm(join(tmp, name), { recursive: true, force: true }).catch(() => {})
      }
    }
  } catch {
    /* egal */
  }
}
