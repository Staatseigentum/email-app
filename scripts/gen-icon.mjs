// Schreibt build/icon.ico und build/icon.png (für Installer + Verknüpfungen).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderIconIco, renderIconPng } from './lib/render-icon.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'build')
mkdirSync(outDir, { recursive: true })

writeFileSync(join(outDir, 'icon.ico'), renderIconIco())
writeFileSync(join(outDir, 'icon.png'), renderIconPng(256))
console.log('Icon geschrieben: build/icon.ico, build/icon.png')
