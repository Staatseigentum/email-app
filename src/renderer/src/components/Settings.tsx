import { useState, type ReactNode } from 'react'
import type { AppSettings, MailAccount } from '../../../shared/types'
import type { Density } from './MessageList'
import { Icon } from './Icon'
import { overline } from '../lib/ui'

const NOTIFY: { key: AppSettings['notify']; label: string; hint: string }[] = [
  { key: 'all', label: 'Alle Ordner', hint: 'Bei jeder neuen Nachricht' },
  { key: 'inbox', label: 'Nur Posteingang', hint: 'Gefilterte Ordner ignorieren' },
  { key: 'off', label: 'Aus', hint: 'Keine Desktop-Hinweise' }
]

function Section(props: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="mb-8">
      <p className={`${overline} mb-3`}>{props.title}</p>
      {props.children}
    </section>
  )
}

function Toggle(props: { on: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button
      onClick={() => props.onChange(!props.on)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition ${
        props.on ? 'bg-accent' : 'bg-chrome-3'
      }`}
    >
      <span
        className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all ${
          props.on ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

export function Settings(props: {
  accounts: MailAccount[]
  settings: AppSettings
  theme: 'dark' | 'light'
  density: Density
  version: string
  onSettings: (patch: Partial<AppSettings>) => void
  onToggleTheme: () => void
  onDensity: (d: Density) => void
  onEdit: (a: MailAccount) => void
  onAdd: () => void
  onDemo: () => void
  onClose: () => void
  onCheckUpdate: () => void
}): JSX.Element {
  const { settings } = props
  const [sigAccount, setSigAccount] = useState(props.accounts[0]?.id ?? '')
  const sig = settings.signatures[sigAccount] ?? ''

  const rowCard = 'flex items-center gap-3 rounded-lg border border-line bg-panel p-3'

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-window">
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line px-6">
        <h1 className="font-display text-lg font-semibold text-ink">Einstellungen</h1>
        <button
          onClick={props.onClose}
          className="ml-auto text-sm text-ink-soft transition hover:text-ink"
        >
          Fertig
        </button>
      </div>

      <div className="mx-auto w-full max-w-[640px] flex-1 overflow-y-auto px-7 py-6">
        <Section title="Erscheinungsbild">
          <div className="space-y-2">
            <div className={rowCard}>
              <Icon name={props.theme === 'dark' ? 'moon' : 'sun'} size={16} className="text-ink-soft" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">Design</div>
                <div className="text-xs text-ink-mute">
                  {props.theme === 'dark' ? 'Dunkel' : 'Hell'}
                </div>
              </div>
              <button
                onClick={props.onToggleTheme}
                className="rounded-[3px] border border-line-control px-3 py-1.5 text-xs text-ink transition hover:border-line-hover"
              >
                Wechseln
              </button>
            </div>
            <div className={rowCard}>
              <Icon name="layers" size={16} className="text-ink-soft" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">Listendichte</div>
                <div className="text-xs text-ink-mute">Abstände in der Nachrichtenliste</div>
              </div>
              <div className="flex gap-1">
                {(['cozy', 'compact'] as Density[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => props.onDensity(d)}
                    className={`rounded-[3px] px-2.5 py-1.5 text-xs transition ${
                      props.density === d
                        ? 'bg-accent-soft text-accent-strong'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {d === 'cozy' ? 'Komfortabel' : 'Kompakt'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Konten">
          <div className="space-y-2">
            {props.accounts.map((a) => (
              <div key={a.id} className={rowCard}>
                <span
                  className="h-8 w-8 shrink-0 rounded-[3px]"
                  style={{ background: a.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">{a.label}</div>
                  <div className="truncate font-mono text-xs text-ink-mute">{a.email}</div>
                </div>
                <button
                  onClick={() => props.onEdit(a)}
                  className="rounded-[3px] border border-line-control px-3 py-1.5 text-xs text-ink transition hover:border-line-hover"
                >
                  Bearbeiten
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={props.onAdd}
              className="rounded-[3px] border border-line-control px-3 py-1.5 text-xs text-ink transition hover:border-line-hover"
            >
              Konto hinzufügen
            </button>
            <button
              onClick={props.onDemo}
              className="rounded-[3px] px-3 py-1.5 text-xs text-ink-soft transition hover:text-ink"
            >
              Demo-Postfach
            </button>
          </div>
        </Section>

        {props.accounts.length > 0 && (
          <Section title="Signatur">
            <div className="rounded-lg border border-line bg-panel p-3">
              {props.accounts.length > 1 && (
                <select
                  value={sigAccount}
                  onChange={(e) => setSigAccount(e.target.value)}
                  className="mb-2 w-full rounded-[3px] border border-line-control bg-well px-2 py-1.5 text-xs text-ink outline-none"
                >
                  {props.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.email}
                    </option>
                  ))}
                </select>
              )}
              <textarea
                value={sig}
                onChange={(e) =>
                  props.onSettings({ signatures: { [sigAccount]: e.target.value } })
                }
                rows={4}
                placeholder={'— \nViele Grüße'}
                className="w-full resize-none rounded-[3px] border border-line-control bg-well px-2.5 py-2 text-sm text-ink outline-none placeholder:text-ink-mute focus:border-accent/50"
              />
              <p className="mt-1.5 text-xs text-ink-mute">
                Wird beim Verfassen und Antworten unten angehängt.
              </p>
            </div>
          </Section>
        )}

        <Section title="Senden">
          <div className={rowCard}>
            <Icon name="clock" size={16} className="text-ink-soft" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">Senden rückgängig machen</div>
              <div className="text-xs text-ink-mute">
                Wartezeit vor dem tatsächlichen Versand
              </div>
            </div>
            <select
              value={settings.undoSendSeconds}
              onChange={(e) => props.onSettings({ undoSendSeconds: Number(e.target.value) })}
              className="rounded-[3px] border border-line-control bg-well px-2 py-1.5 text-xs text-ink outline-none"
            >
              {[0, 5, 10, 20, 30].map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? 'Sofort' : `${s} s`}
                </option>
              ))}
            </select>
          </div>
        </Section>

        <Section title="Datenschutz">
          <div className="space-y-2">
            <div className={rowCard}>
              <Icon name="shield-check" size={16} className="text-ink-soft" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">Externe Inhalte blockieren</div>
                <div className="text-xs text-ink-mute">
                  Bilder & Tracker erst nach Freigabe laden
                </div>
              </div>
              <Toggle
                on={settings.blockRemoteContent}
                onChange={(v) => props.onSettings({ blockRemoteContent: v })}
              />
            </div>
            {settings.remoteAllow.length > 0 && (
              <div className="rounded-lg border border-line bg-panel p-3">
                <p className="mb-2 text-xs text-ink-mute">Immer erlaubt</p>
                <div className="flex flex-wrap gap-1.5">
                  {settings.remoteAllow.map((e) => (
                    <span
                      key={e}
                      className="flex items-center gap-1 rounded-full bg-chrome-2 py-1 pl-2.5 pr-1 text-xs text-ink-soft"
                    >
                      {e}
                      <button
                        onClick={() =>
                          props.onSettings({
                            remoteAllow: settings.remoteAllow.filter((x) => x !== e)
                          })
                        }
                        className="grid h-4 w-4 place-items-center rounded-full text-ink-mute hover:text-ink"
                      >
                        <Icon name="x" size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section title="Benachrichtigungen">
          <div className="space-y-2">
            {NOTIFY.map((n) => (
              <button
                key={n.key}
                onClick={() => props.onSettings({ notify: n.key })}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                  settings.notify === n.key
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-panel hover:border-line-hover'
                }`}
              >
                <Icon
                  name={settings.notify === n.key ? 'check-circle' : 'bell'}
                  size={16}
                  className={settings.notify === n.key ? 'text-accent-text' : 'text-ink-soft'}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{n.label}</div>
                  <div className="text-xs text-ink-mute">{n.hint}</div>
                </div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Über">
          <div className={rowCard}>
            <Icon name="info" size={16} className="text-ink-soft" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">MailWave {props.version}</div>
              <div className="text-xs text-ink-mute">Desktop-E-Mail-Client</div>
            </div>
            <button
              onClick={props.onCheckUpdate}
              className="rounded-[3px] border border-line-control px-3 py-1.5 text-xs text-ink transition hover:border-line-hover"
            >
              Nach Updates suchen
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}
