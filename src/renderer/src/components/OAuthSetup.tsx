import { useState } from 'react'
import type { OAuthClientConfig, OAuthProvider } from '../../../shared/types'

const api = window.mailwave

const GOOGLE_STEPS = [
  'Google Cloud Console öffnen und ein Projekt anlegen (z. B. „MailWave").',
  'APIs & Dienste → OAuth-Zustimmungsbildschirm: Typ „Extern", App-Name + deine E-Mail.',
  'Wichtig: dort auf „App veröffentlichen" / „In Produktion" – sonst Fehler 403 und Tokens laufen nach 7 Tagen ab. (Alternativ im Test-Modus deine Gmail unter „Testnutzer" eintragen.)',
  'APIs & Dienste → Anmeldedaten → „Anmeldedaten erstellen" → OAuth-Client-ID → Typ „Desktop-App".',
  'Beim erstellten Client „JSON herunterladen" – dann hier die Datei wählen.',
  'Beim ersten Login: „Erweitert" → „Weiter zu … (unsicher)" – bei der eigenen App normal.'
]

const MS_STEPS = [
  'Microsoft Entra öffnen → „App-Registrierungen" → „Neue Registrierung".',
  'Kontotypen: „beliebiges Verzeichnis und persönliche Microsoft-Konten".',
  'Plattform „Mobile- und Desktopanwendungen", Redirect-URI: http://localhost, „öffentliche Clientflows zulassen" = Ja.',
  'Übersicht → „Anwendungs-(Client-)ID" kopieren und hier einfügen.'
]

export function OAuthSetup(props: {
  provider: OAuthProvider
  config: OAuthClientConfig
  onChange: (c: OAuthClientConfig) => void
  onCancel: () => void
}): JSX.Element {
  const isGoogle = props.provider === 'google'
  const [gId, setGId] = useState(props.config.google.clientId)
  const [gSecret, setGSecret] = useState('')
  const [msId, setMsId] = useState(props.config.microsoft.clientId)
  const [busy, setBusy] = useState<false | 'save' | 'import'>(false)
  const [err, setErr] = useState<string | null>(null)

  const consoleUrl = isGoogle
    ? 'https://console.cloud.google.com/apis/credentials'
    : 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade'

  function maybeExtractJson(value: string): void {
    const trimmed = value.trim()
    if (trimmed.startsWith('{')) {
      try {
        const j = JSON.parse(trimmed)
        const node = j.installed ?? j.web ?? j
        if (node.client_id) setGId(String(node.client_id))
        if (node.client_secret) setGSecret(String(node.client_secret))
        return
      } catch {
        /* normal weiter */
      }
    }
    setGId(value)
  }

  async function importFile(): Promise<void> {
    setBusy('import')
    setErr(null)
    const r = await api.oauth.importGoogle()
    setBusy(false)
    if (r.ok) {
      props.onChange(r.data)
      if (r.data.google.configured) return
      setErr('Datei gewählt, aber es fehlen Werte. Bitte eine „Desktop"-Client-ID nutzen.')
    } else setErr(r.error)
  }

  async function save(): Promise<void> {
    setBusy('save')
    setErr(null)
    const r = await api.oauth.setConfig(
      isGoogle
        ? { googleClientId: gId, googleClientSecret: gSecret }
        : { microsoftClientId: msId }
    )
    setBusy(false)
    if (r.ok) props.onChange(r.data)
    else setErr(r.error)
  }

  const input =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-white/5'

  return (
    <div className="space-y-3 rounded-xl border border-amber-300/50 bg-amber-50 p-3 dark:bg-amber-500/10">
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
        Browser-Login einmalig einrichten ({isGoogle ? 'Google' : 'Microsoft'})
      </p>

      <ol className="ml-4 list-decimal space-y-1 text-xs text-amber-800/90 dark:text-amber-200/80">
        {(isGoogle ? GOOGLE_STEPS : MS_STEPS).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <button
        onClick={() => api.openExternal(consoleUrl)}
        className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
      >
        {isGoogle ? 'Google Cloud Console öffnen ↗' : 'Microsoft Entra öffnen ↗'}
      </button>

      <div className="space-y-2 border-t border-amber-300/40 pt-2">
        {isGoogle ? (
          <>
            <button
              onClick={importFile}
              disabled={busy !== false}
              className="w-full rounded-lg border border-amber-400 bg-white/70 py-2 text-xs font-semibold text-amber-800 transition hover:bg-white disabled:opacity-50 dark:bg-white/10 dark:text-amber-200"
            >
              {busy === 'import' ? 'Lese Datei…' : '📄 credentials.json wählen'}
            </button>
            <p className="text-center text-[11px] text-amber-700/70">oder Werte manuell eintragen</p>
            <input
              value={gId}
              onChange={(e) => maybeExtractJson(e.target.value)}
              className={input}
              placeholder="Client-ID (oder ganzes JSON hier einfügen)"
            />
            <input
              value={gSecret}
              onChange={(e) => setGSecret(e.target.value)}
              className={input}
              placeholder="Client-Secret"
              type="password"
            />
          </>
        ) : (
          <input
            value={msId}
            onChange={(e) => setMsId(e.target.value)}
            className={input}
            placeholder="Anwendungs-(Client-)ID"
          />
        )}

        {err && <p className="text-xs text-rose-600">{err}</p>}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={busy !== false || (isGoogle ? !gId || !gSecret : !msId)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {busy === 'save' ? 'Speichern…' : 'Speichern'}
          </button>
          <button onClick={props.onCancel} className="text-xs text-slate-500 hover:underline">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
