// Wrapper um die electron-vite-CLI.
// Manche Umgebungen (z. B. integrierte Editor-Terminals) setzen
// ELECTRON_RUN_AS_NODE=1. Dann startet Electron nur als reines Node
// und `require('electron')` liefert einen Pfad-String statt der API.
// Wir entfernen die Variable, bevor electron-vite Electron startet.
delete process.env.ELECTRON_RUN_AS_NODE

import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const pkgPath = require.resolve('electron-vite/package.json')
const binRel = require('electron-vite/package.json').bin['electron-vite']
const binPath = join(pkgPath, '..', binRel)

await import(pathToFileURL(binPath).href)
