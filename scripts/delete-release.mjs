// Entfernt ein GitHub-Release samt Tag – für zurückgezogene / fehlerhafte Versionen.
//
//   node scripts/delete-release.mjs v0.0.2
//
// Token-Quelle wie bei publish-release.mjs:
//   1. GH_TOKEN / GITHUB_TOKEN
//   2. git credential fill (derselbe Login wie für `git push`)

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const repo = pkg.mailwave?.updateRepo || 'Staatseigentum/email-app'

const tag = process.argv[2]
if (!tag) {
  console.error('Aufruf: node scripts/delete-release.mjs <tag>   (z. B. v0.0.2)')
  process.exit(1)
}

const token = resolveToken()

const rel = await api('GET', `/repos/${repo}/releases/tags/${tag}`).catch(() => null)
if (rel?.id) {
  await api('DELETE', `/repos/${repo}/releases/${rel.id}`)
  console.log(`Release ${tag} gelöscht.`)
} else {
  console.log(`Kein Release für ${tag} gefunden.`)
}

await api('DELETE', `/repos/${repo}/git/refs/tags/${tag}`)
  .then(() => console.log(`Tag ${tag} gelöscht.`))
  .catch((err) => console.log(`Tag ${tag} nicht entfernt: ${err.message}`))

// ---------------------------------------------------------------------------

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
  console.error('Kein GitHub-Token. Setze GH_TOKEN oder melde dich einmal per `git push` an.')
  process.exit(1)
}

function api(method, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        host: 'api.github.com',
        path,
        headers: {
          'User-Agent': 'mailwave-release',
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          if ((res.statusCode || 0) >= 400) {
            reject(new Error(`${method} ${path} → ${res.statusCode} ${text}`))
            return
          }
          resolve(text ? JSON.parse(text) : {})
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}
