import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/shared/oneTimeCode.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText
const { extractOneTimeCode } = await import(
  `data:text/javascript,${encodeURIComponent(compiled)}`
)

test('findet einen Twitch Code im Betreff', () => {
  assert.equal(extractOneTimeCode('Your Twitch verification code: 123456', ''), '123456')
})

test('findet deutsche Codes im Nachrichtentext', () => {
  assert.equal(extractOneTimeCode('Anmeldung', 'Dein Bestätigungscode lautet 407182.'), '407182')
})

test('findet Codes auch vor dem Hinweis', () => {
  assert.equal(extractOneTimeCode('Twitch', '123456 is your login verification code.'), '123456')
})

test('kopiert keine zufällige Bestellnummer', () => {
  assert.equal(extractOneTimeCode('Bestellung 123456', 'Deine Rechnung ist da.'), null)
})

test('bevorzugt den Code gegenüber einer Jahreszahl', () => {
  assert.equal(extractOneTimeCode('Sicherheitscode', 'Im Jahr 2026 ist dein Code 875923.'), '875923')
})
