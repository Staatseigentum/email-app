// Baut aus der Electron-Distribution + out/ + Produktions-Abhängigkeiten
// einen lauffähigen, portablen App-Ordner: release/MailWave/
//
// Ergebnis:
//   release/MailWave/MailWave.exe          (umbenannte electron.exe)
//   release/MailWave/resources/app/        (package.json, out/, node_modules)
//   release/MailWave/Updater.exe           (wird von build-installer.mjs ergänzt)
//
// Kein electron-builder, kein asar – Electron lädt resources/app/ direkt.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const distDir = join(root, 'node_modules', 'electron', 'dist')
const outApp = join(root, 'release', 'MailWave')
const appDir = join(outApp, 'resources', 'app')

// Nur diese Sprachpakete behalten (spart ~40 MB)
const KEEP_LOCALES = new Set(['en-US.pak', 'de.pak'])

function log(...a) {
  console.log('[pack]', ...a)
}

if (!existsSync(distDir)) {
  throw new Error('Electron-Distribution fehlt – erst `npm install`.')
}
if (!existsSync(join(root, 'out', 'main', 'index.js'))) {
  throw new Error('out/ fehlt – erst `npm run build`.')
}

log('räume', outApp)
rmSync(outApp, { recursive: true, force: true })
mkdirSync(appDir, { recursive: true })

// 1) Electron-Laufzeit kopieren
log('kopiere Electron-Laufzeit …')
cpSync(distDir, outApp, {
  recursive: true,
  filter: (src) => {
    const rel = src.slice(distDir.length + 1).replace(/\\/g, '/')
    if (rel === 'LICENSES.chromium.html') return false
    if (rel.startsWith('locales/') && rel.endsWith('.pak')) {
      return KEEP_LOCALES.has(rel.slice('locales/'.length))
    }
    return true
  }
})

// electron.exe -> MailWave.exe
const productExe = join(outApp, `${pkg.mailwave.productName}.exe`)
cpSync(join(outApp, 'electron.exe'), productExe)
rmSync(join(outApp, 'electron.exe'))

// 2) App-Code
log('kopiere out/ …')
cpSync(join(root, 'out'), join(appDir, 'out'), { recursive: true })

// getrimmte package.json für die gepackte App
const runtimePkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: 'out/main/index.js',
  author: pkg.author,
  license: pkg.license,
  mailwave: pkg.mailwave,
  dependencies: pkg.dependencies
}
writeFileSync(join(appDir, 'package.json'), JSON.stringify(runtimePkg, null, 2))

// 3) Produktions-Abhängigkeiten (transitive Hülle) kopieren
log('sammle Produktions-Abhängigkeiten …')
const nm = join(root, 'node_modules')
const wanted = new Set()

function collect(name) {
  if (wanted.has(name)) return
  const pj = join(nm, name, 'package.json')
  if (!existsSync(pj)) return
  wanted.add(name)
  const meta = JSON.parse(readFileSync(pj, 'utf8'))
  for (const dep of Object.keys(meta.dependencies || {})) collect(dep)
  for (const dep of Object.keys(meta.optionalDependencies || {})) collect(dep)
}
for (const dep of Object.keys(pkg.dependencies)) collect(dep)

const destNm = join(appDir, 'node_modules')
mkdirSync(destNm, { recursive: true })
for (const name of wanted) {
  const from = join(nm, name)
  if (!existsSync(from)) continue
  mkdirSync(dirname(join(destNm, name)), { recursive: true })
  // Ganzes Paket inkl. verschachtelter node_modules kopieren – so bleibt die
  // Node-Auflösung exakt erhalten (Pakete mit "exports"-Feld sind sonst kaputt).
  cpSync(from, join(destNm, name), { recursive: true })
}
log(`${wanted.size} Pakete kopiert`)

// 4) Manifest (Version für den In-App-Updater + Installer)
writeFileSync(
  join(outApp, 'resources', 'mailwave-version.txt'),
  `${pkg.version}\n`
)

const files = readdirSync(outApp)
log('fertig →', outApp)
log('Inhalt:', files.join(', '))
