// Erstellt ein GitHub-Release für die aktuelle package.json-Version und lädt
// release/MailWave-Setup-<version>.exe als Asset hoch.
//
//   node scripts/publish-release.mjs [--draft] [--notes "Text"]
//
// Token-Quelle (in dieser Reihenfolge):
//   1. Umgebungsvariable GH_TOKEN oder GITHUB_TOKEN
//   2. git credential fill  (derselbe Login wie für `git push`)
//
// Kein gh-CLI nötig.

import { execFileSync } from 'node:child_process'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const repo = pkg.mailwave?.updateRepo || 'Staatseigentum/email-app'
const tag = `v${version}`

const args = process.argv.slice(2)
const draft = args.includes('--draft')
const notesArg = args[args.indexOf('--notes') + 1]
const asset = join(root, 'release', `MailWave-Setup-${version}.exe`)

if (!statSafe(asset)) {
  console.error(`Fehlt: ${asset}\nErst  npm run installer  ausführen.`)
  process.exit(1)
}

const token = resolveToken()

const notes =
  notesArg ||
  `MailWave ${version}

Windows-Installer (pro Benutzer, ohne Administratorrechte). Automatische Updates sind eingebaut.

Installation: MailWave-Setup-${version}.exe herunterladen und ausführen.`

const body = {
  tag_name: tag,
  name: `MailWave ${version}`,
  body: notes,
  draft,
  prerelease: version.startsWith('0.')
}

const release = await api('POST', `/repos/${repo}/releases`, body).catch(async (err) => {
  if (String(err).includes('already_exists')) {
    console.log(`Release ${tag} existiert schon – hole es …`)
    return api('GET', `/repos/${repo}/releases/tags/${tag}`)
  }
  throw err
})

console.log(`Release: ${release.html_url}`)

// vorhandenes gleichnamiges Asset entfernen
const name = basename(asset)
for (const a of release.assets || []) {
  if (a.name === name) {
    console.log(`ersetze bestehendes Asset ${name} …`)
    await api('DELETE', `/repos/${repo}/releases/assets/${a.id}`)
  }
}

const size = statSync(asset).size
console.log(`lade ${name} hoch (${(size / 1048576).toFixed(1)} MB) …`)
const uploaded = await upload(release, name, asset, size)
console.log(`fertig: ${uploaded.browser_download_url}`)

// ---------------------------------------------------------------------------

function statSafe(p) {
  try {
    return statSync(p)
  } catch {
    return null
  }
}

function resolveToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  try {
    const out = execFileSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8'
    })
    const m = out.match(/password=(.+)/)
    if (m) return m[1].trim()
  } catch {
    /* fällt unten durch */
  }
  console.error(
    'Kein GitHub-Token. Setze GH_TOKEN oder melde dich einmal per `git push` an.'
  )
  process.exit(1)
}

function api(method, path, payload) {
  return request({
    method,
    host: 'api.github.com',
    path,
    body: payload ? Buffer.from(JSON.stringify(payload)) : null,
    headers: { 'Content-Type': 'application/json' }
  })
}

function upload(release, name, file, size) {
  const uploadHost = new URL(release.upload_url.split('{')[0]).host
  const uploadPath = release.upload_url.split('{')[0].replace(`https://${uploadHost}`, '')
  return request({
    method: 'POST',
    host: uploadHost,
    path: `${uploadPath}?name=${encodeURIComponent(name)}`,
    headers: { 'Content-Type': 'application/vnd.microsoft.portable-executable', 'Content-Length': size },
    stream: createReadStream(file)
  })
}

function request(opts) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: opts.method,
        host: opts.host,
        path: opts.path,
        headers: {
          'User-Agent': 'mailwave-release',
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...opts.headers
        }
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          if ((res.statusCode || 0) >= 400) {
            reject(new Error(`${opts.method} ${opts.path} → ${res.statusCode} ${text}`))
            return
          }
          resolve(text ? JSON.parse(text) : {})
        })
      }
    )
    req.on('error', reject)
    if (opts.stream) opts.stream.pipe(req)
    else {
      if (opts.body) req.write(opts.body)
      req.end()
    }
  })
}
