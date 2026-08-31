// Baut release/MailWave-Setup-<version>.exe – ohne electron-builder / NSIS / Inno.
//
// Schritte:
//   1. build/icon.ico sicherstellen
//   2. installer/Updater.cs      -> release/MailWave/Updater.exe   (in den Payload)
//   3. release/MailWave/**       -> payload.zip
//   4. installer/Uninstaller.cs  -> Uninstall.exe                  (Ressource)
//   5. installer/Installer.cs    -> release/MailWave-Setup-<v>.exe (Payload + Icon + Uninstaller eingebettet)
//
// Compiler: das mit dem .NET Framework gelieferte csc.exe (C# 5) – auf jedem Windows vorhanden.

import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createZip } from './lib/zip.mjs'
import { renderIconIco } from './lib/render-icon.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const appDir = join(root, 'release', 'MailWave')
const workDir = join(root, 'release', '.installer-build')
const installerSrc = join(root, 'installer')

const CSC = findCsc()

function log(...a) {
  console.log('[installer]', ...a)
}

function findCsc() {
  const candidates = [
    join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
    join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
  ]
  for (const c of candidates) if (existsSync(c)) return c
  throw new Error('csc.exe (.NET Framework) nicht gefunden – wird für den Installer-Build benötigt.')
}

function csc(outFile, sources, opts = {}) {
  const args = [
    '/nologo',
    '/target:winexe',
    '/optimize+',
    '/platform:anycpu',
    `/out:${outFile}`,
    `/win32manifest:${join(installerSrc, 'app.manifest')}`
  ]
  if (opts.icon) args.push(`/win32icon:${opts.icon}`)
  for (const r of opts.refs || []) args.push(`/reference:${r}`)
  for (const res of opts.resources || []) args.push(`/resource:${res.file},${res.name}`)
  args.push(...sources)
  execFileSync(CSC, args, { stdio: 'inherit' })
}

function collectFiles(dir, base = dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectFiles(full, base))
    else out.push({ name: relative(base, full).replace(/\\/g, '/'), full })
  }
  return out
}

// ---------------------------------------------------------------------------

if (!existsSync(join(appDir, 'MailWave.exe'))) {
  throw new Error('release/MailWave/ fehlt – erst `npm run pack`.')
}

const icoPath = join(root, 'build', 'icon.ico')
mkdirSync(join(root, 'build'), { recursive: true })
if (!existsSync(icoPath)) {
  writeFileSync(icoPath, renderIconIco())
  log('Icon erzeugt: build/icon.ico')
}

rmSync(workDir, { recursive: true, force: true })
mkdirSync(workDir, { recursive: true })

// 1) Bootstrap-Updater -> in den App-Ordner (wird mitgepackt)
log('kompiliere Updater.exe …')
const updaterExe = join(appDir, 'Updater.exe')
csc(updaterExe, [join(installerSrc, 'Updater.cs')], {
  icon: icoPath,
  refs: ['System.Windows.Forms.dll', 'System.Drawing.dll']
})

// 2) Payload zippen
log('packe payload.zip …')
const files = collectFiles(appDir)
const payloadBytes = files.reduce((n, f) => n + statSync(f.full).size, 0)
log(`${files.length} Dateien, ${(payloadBytes / 1048576).toFixed(1)} MB`)
const zipEntries = files.map((f) => ({ name: f.name, data: readFileSync(f.full) }))
const payloadZip = join(workDir, 'payload.zip')
writeFileSync(payloadZip, createZip(zipEntries))
log(`payload.zip: ${(statSync(payloadZip).size / 1048576).toFixed(1)} MB`)

// 3) Uninstaller
log('kompiliere Uninstall.exe …')
const uninstallExe = join(workDir, 'Uninstall.exe')
csc(uninstallExe, [join(installerSrc, 'Uninstaller.cs')], {
  icon: icoPath,
  refs: ['System.Windows.Forms.dll', 'System.Drawing.dll']
})

// 4) Installer mit eingebetteten Ressourcen
log('kompiliere Setup.exe …')
const installerCs = readFileSync(join(installerSrc, 'Installer.cs'), 'utf8').replace(
  /__VERSION__/g,
  version
)
const installerCsPath = join(workDir, 'Installer.gen.cs')
writeFileSync(installerCsPath, installerCs)

const setupExe = join(root, 'release', `MailWave-Setup-${version}.exe`)
csc(setupExe, [installerCsPath], {
  icon: icoPath,
  refs: [
    'System.Windows.Forms.dll',
    'System.Drawing.dll',
    'System.Core.dll',
    'System.IO.Compression.dll'
  ],
  resources: [
    { file: payloadZip, name: 'payload.zip' },
    { file: icoPath, name: 'icon.ico' },
    { file: uninstallExe, name: 'Uninstall.exe' }
  ]
})

rmSync(workDir, { recursive: true, force: true })
log('fertig →', relative(root, setupExe))
log(`Größe: ${(statSync(setupExe).size / 1048576).toFixed(1)} MB`)
