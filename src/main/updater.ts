import { app, BrowserWindow, ipcMain, net, shell } from 'electron'
import { spawn } from 'child_process'
import { createWriteStream, existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs'
import { lstat, readdir, realpath, rm } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { createHash, randomBytes } from 'crypto'
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
  currentEvent = evt
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.onUpdate, evt)
}

let currentEvent: UpdateEvent = { state: 'none' }

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
      res.on('error', reject)
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

function download(info: UpdateInfo, dest: string, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false
    let file: ReturnType<typeof createWriteStream> | null = null
    const fail = (err: Error): void => {
      if (finished) return
      finished = true
      file?.destroy()
      reject(err)
    }
    const req = net.request({ url: info.url, redirect: 'follow' })
    req.setHeader('User-Agent', 'MailWave-Updater')
    req.setHeader('Accept', 'application/octet-stream')
    req.on('response', (res) => {
      if (res.statusCode !== 200) {
        fail(new Error(`Download ${res.statusCode}`))
        return
      }
      const total = info.size || parseInt(String(res.headers['content-length'] || '0'), 10)
      const hash = createHash('sha256')
      let got = 0
      file = createWriteStream(dest)
      file.on('error', fail)
      res.on('data', (c) => {
        if (finished) return
        const chunk = Buffer.from(c)
        got += chunk.length
        hash.update(chunk)
        file?.write(chunk)
        if (total && onProgress) onProgress(Math.min(100, Math.round((got / total) * 100)))
      })
      res.on('end', () => {
        if (finished) return
        file?.end(() => {
          if (finished) return
          if (info.size && got !== info.size) {
            fail(new Error('Download ist unvollständig.'))
            return
          }
          if (info.sha256 && hash.digest('hex').toLowerCase() !== info.sha256.toLowerCase()) {
            fail(new Error('Prüfsumme des Updates stimmt nicht überein.'))
            return
          }
          finished = true
          resolve()
        })
      })
      res.on('error', fail)
    })
    req.on('error', fail)
    req.end()
  })
}

let checkPromise: Promise<UpdateInfo | null> | null = null
let cached: UpdateInfo | null = null
let applying = false

async function fetchUpdateInfo(): Promise<UpdateInfo | null> {
  const list = await getJson(`https://api.github.com/repos/${repo()}/releases?per_page=15`)
  const releases = (Array.isArray(list) ? list : [])
    .filter((r: any) => r && !r.draft && !r.prerelease && !String(r.tag_name).includes('-'))
    .sort((a: any, b: any) =>
      isNewer(a.tag_name || '', b.tag_name || '') ? -1 : isNewer(b.tag_name || '', a.tag_name || '') ? 1 : 0
    )
  const found = releases
    .map((rel: any) => ({
      rel,
      asset: (rel.assets || []).find((a: any) =>
        SETUP_ASSET.test(a?.name || '') &&
        a.name.toLowerCase() === `mailwave-setup-${String(rel.tag_name).replace(/^v/, '').toLowerCase()}.exe`
      )
    }))
    .find(({ asset }: { asset: any }) => Boolean(asset))
  const tag: string = found?.rel.tag_name || ''
  if (!found || !tag || !isNewer(tag, app.getVersion())) {
    cached = null
    return null
  }
  const asset = found.asset
  const digest = /^sha256:([a-f0-9]{64})$/i.exec(asset.digest || '')
  cached = {
    version: tag.replace(/^v/, ''),
    notes: (found.rel.body || '').trim().slice(0, 2000),
    url: asset.browser_download_url,
    size: asset.size || 0,
    sha256: digest?.[1]
  }
  return cached
}

export async function checkForUpdates(
  opts: { silent?: boolean; announceAvailable?: boolean } = {}
): Promise<UpdateInfo | null> {
  if (applying) return cached
  if (!checkPromise) {
    checkPromise = fetchUpdateInfo().finally(() => { checkPromise = null })
  }
  try {
    const info = await checkPromise
    if (info && opts.announceAvailable !== false) broadcast({ state: 'available', info })
    else if (!info && !opts.silent) broadcast({ state: 'none' })
    return info
  } catch (err) {
    if (!opts.silent) broadcast({ state: 'error', message: (err as Error).message })
    return null
  }
}

export async function applyUpdate(opts: { automatic?: boolean } = {}): Promise<void> {
  if (applying) return
  const info = cached
  if (!info) return

  const exeDir = dirname(app.getPath('exe'))
  const bootstrapSrc = join(exeDir, 'Updater.exe')

  // Ohne Bootstrap-Updater (z. B. Dev): einfach die Download-Seite öffnen.
  if (!existsSync(bootstrapSrc)) {
    if (opts.automatic) {
      broadcast({ state: 'error', message: 'Bootstrap-Updater fehlt. Bitte MailWave manuell aktualisieren.' })
    } else await shell.openExternal(`https://github.com/${repo()}/releases/tag/v${info.version}`)
    return
  }

  applying = true
  let tmp: string | null = null
  try {
    tmp = join(app.getPath('temp'), `mailwave-update-${randomBytes(4).toString('hex')}`)
    mkdirSync(tmp, { recursive: true })
    const bootstrap = join(tmp, 'Updater.exe')
    copyFileSync(bootstrapSrc, bootstrap)

    const setup = join(tmp, `MailWave-Setup-${info.version}.exe`)
    broadcast({ state: 'downloading', info, progress: 0 })
    let lastProgress = -1
    await download(info, setup, (pct) => {
      if (pct !== lastProgress) {
        lastProgress = pct
        broadcast({ state: 'downloading', info, progress: pct })
      }
    })

    broadcast({ state: 'ready', info })

    const child = spawn(
      bootstrap,
      [
        '--setup', setup,
        '--wait', String(process.pid),
        '--launch', app.getPath('exe'),
        '--version', info.version
      ],
      { detached: true, stdio: 'ignore', windowsHide: true }
    )
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', () => resolve())
      child.once('error', reject)
    })
    child.unref()

    setTimeout(() => app.quit(), 400)
  } catch (err) {
    applying = false
    if (tmp) void rm(tmp, { recursive: true, force: true }).catch(() => {})
    broadcast({ state: 'error', message: (err as Error).message })
  }
}

export function initUpdater(): void {
  ipcMain.handle(IPC.updateCheck, () => checkForUpdates({ silent: false }))
  ipcMain.handle(IPC.updateApply, () => applyUpdate())
  ipcMain.handle(IPC.updateState, () => currentEvent)

  if (!app.isPackaged || process.platform !== 'win32') return
  void cleanupUpdateTemp()
  setTimeout(async () => {
    const info = await checkForUpdates({ silent: true, announceAvailable: false })
    if (info) await applyUpdate({ automatic: true })
  }, 1500)
  setInterval(() => void checkForUpdates({ silent: true }), CHECK_INTERVAL_MS)
}

/** Aufräumen alter Update-Ordner aus dem Temp-Verzeichnis (best effort). */
export async function cleanupUpdateTemp(): Promise<void> {
  try {
    const tmp = resolve(app.getPath('temp'))
    const realTmp = await realpath(tmp)
    for (const name of await readdir(tmp)) {
      if (!/^mailwave-update-[a-f0-9]{8}$/.test(name)) continue
      const target = resolve(tmp, name)
      if (dirname(target) !== tmp) continue
      const entry = await lstat(target)
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue
      if (dirname(await realpath(target)).toLowerCase() !== realTmp.toLowerCase()) continue
      const age = Date.now() - entry.mtimeMs
      if (age < 24 * 60 * 60 * 1000) continue
      await rm(target, { recursive: true, force: true }).catch(() => {})
    }
  } catch {
    /* egal */
  }
}
