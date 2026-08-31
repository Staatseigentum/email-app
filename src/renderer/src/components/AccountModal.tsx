import { useMemo, useState } from 'react'
import type { IpcResult, MailAccount, MailAccountInput } from '../../../shared/types'
import { detectProvider, PROVIDER_PRESETS, providerById } from '../lib/providers'
import { IconX } from './Icons'

const KEEP = ' keep'

export function AccountModal(props: {
  account?: MailAccount
  onClose: () => void
  onSave: (input: MailAccountInput) => Promise<void>
  onDelete?: (id: string) => void | Promise<void>
  onTest: (input: MailAccountInput) => Promise<IpcResult<boolean>>
}): JSX.Element {
  const editing = Boolean(props.account)
  const a = props.account

  // 'pick' = Anbieterauswahl, 'form' = Eingabemaske
  const [step, setStep] = useState<'pick' | 'form'>(editing ? 'form' : 'pick')
  const [providerId, setProviderId] = useState<string>(
    editing ? detectProvider(a?.email ?? '')?.id ?? 'other' : 'other'
  )

  const [label, setLabel] = useState(a?.label ?? '')
  const [name, setName] = useState(a?.name ?? '')
  const [email, setEmail] = useState(a?.email ?? '')
  const [user, setUser] = useState(a?.user ?? '')
  const [password, setPassword] = useState(editing ? KEEP : '')
  const [imapHost, setImapHost] = useState(a?.imap.host ?? '')
  const [imapPort, setImapPort] = useState(a?.imap.port ?? 993)
  const [imapSecure, setImapSecure] = useState(a?.imap.secure ?? true)
  const [smtpHost, setSmtpHost] = useState(a?.smtp.host ?? '')
  const [smtpPort, setSmtpPort] = useState(a?.smtp.port ?? 465)
  const [smtpSecure, setSmtpSecure] = useState(a?.smtp.secure ?? true)
  const [advanced, setAdvanced] = useState(editing)
  const [busy, setBusy] = useState<false | 'test' | 'save'>(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const preset = useMemo(() => providerById(providerId), [providerId])
  const isOther = providerId === 'other'

  function chooseProvider(id: string): void {
    setProviderId(id)
    setFeedback(null)
    const p = providerById(id)
    if (p) {
      setImapHost(p.imap.host)
      setImapPort(p.imap.port)
      setImapSecure(p.imap.secure)
      setSmtpHost(p.smtp.host)
      setSmtpPort(p.smtp.port)
      setSmtpSecure(p.smtp.secure)
      if (!label) setLabel(p.label)
      setAdvanced(false)
    } else {
      setImapHost('')
      setSmtpHost('')
      setAdvanced(true)
    }
    setStep('form')
  }

  function applyEmail(value: string): void {
    setEmail(value)
    if (!user || user === email) setUser(value)
    if (isOther) {
      const domain = value.split('@')[1] ?? ''
      if (domain.includes('.')) {
        setImapHost((h) => h || `imap.${domain}`)
        setSmtpHost((h) => h || `smtp.${domain}`)
      }
    }
  }

  function buildInput(): MailAccountInput {
    return {
      id: a?.id,
      label: label || preset?.label || email,
      name: name || email,
      email,
      user: user || email,
      password,
      imap: { host: imapHost, port: Number(imapPort), secure: imapSecure },
      smtp: { host: smtpHost, port: Number(smtpPort), secure: smtpSecure }
    }
  }

  const valid =
    email.includes('@') && imapHost && smtpHost && (editing || password.length > 0)

  async function test(): Promise<void> {
    setBusy('test')
    setFeedback(null)
    const res = await props.onTest(buildInput())
    setBusy(false)
    setFeedback(
      res.ok
        ? { ok: true, msg: 'Verbindung erfolgreich – IMAP & SMTP erreichbar.' }
        : { ok: false, msg: res.error }
    )
  }

  async function save(): Promise<void> {
    setBusy('save')
    setFeedback(null)
    try {
      await props.onSave(buildInput())
    } catch (e) {
      setBusy(false)
      setFeedback({ ok: false, msg: (e as Error).message })
    }
  }

  const input =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-white/5'
  const lbl = 'mb-1 block text-xs font-medium text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={props.onClose} />
      <div className="animate-fade-in relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#141a2b]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">
            {editing
              ? 'Konto bearbeiten'
              : step === 'pick'
                ? 'Anbieter wählen'
                : `${preset?.label ?? 'E-Mail-Konto'} einrichten`}
          </h3>
          <button
            onClick={props.onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <IconX width={16} height={16} />
          </button>
        </div>

        {step === 'pick' ? (
          <div>
            <p className="mb-3 text-xs text-slate-500">
              Wähle deinen Anbieter – IMAP- und SMTP-Server werden automatisch gesetzt.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => chooseProvider(p.id)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 px-2 py-3 text-xs font-medium transition hover:border-brand-400 hover:bg-brand-500/5 dark:border-white/10"
                >
                  <span
                    className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: p.color }}
                  >
                    {p.label.slice(0, 1)}
                  </span>
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => chooseProvider('other')}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 px-2 py-3 text-xs font-medium transition hover:border-brand-400 hover:bg-brand-500/5 dark:border-white/10"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-400 text-sm font-bold text-white">
                  +
                </span>
                Anderer / IMAP
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {!editing && (
              <button
                onClick={() => setStep('pick')}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                ← anderer Anbieter
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Absendername</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={input}
                  placeholder="Marco Ebner"
                />
              </div>
              <div>
                <label className={lbl}>Kontobezeichnung</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className={input}
                  placeholder={preset?.label ?? 'Privat'}
                />
              </div>
            </div>

            <div>
              <label className={lbl}>E-Mail-Adresse</label>
              <input
                value={email}
                onChange={(e) => applyEmail(e.target.value)}
                className={input}
                placeholder={isOther ? 'name@deine-domain.de' : `name@${preset?.label.toLowerCase()}…`}
                type="email"
                autoFocus
              />
            </div>

            <div>
              <label className={lbl}>
                {preset?.appPassword ? 'App-Passwort' : 'Passwort'}
                {editing && ' (leer lassen = unverändert)'}
              </label>
              <input
                value={password === KEEP ? '' : password}
                onChange={(e) => setPassword(e.target.value || (editing ? KEEP : ''))}
                className={input}
                type="password"
                placeholder={editing ? '••••••••' : preset?.appPassword ? '16-stelliger Code' : ''}
              />
              {preset?.hint && (
                <p className="mt-1 text-xs text-amber-600">{preset.hint}</p>
              )}
            </div>

            {!isOther && (
              <button
                onClick={() => setAdvanced((v) => !v)}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                {advanced ? 'Servereinstellungen ausblenden' : 'Servereinstellungen anzeigen'}
              </button>
            )}

            {(advanced || isOther) && (
              <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <div>
                  <label className={lbl}>Benutzername (falls abweichend von der Adresse)</label>
                  <input value={user} onChange={(e) => setUser(e.target.value)} className={input} />
                </div>
                <div className="grid grid-cols-[1fr,80px,auto] items-end gap-2">
                  <div>
                    <label className={lbl}>IMAP-Server</label>
                    <input value={imapHost} onChange={(e) => setImapHost(e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Port</label>
                    <input
                      type="number"
                      value={imapPort}
                      onChange={(e) => setImapPort(Number(e.target.value))}
                      className={input}
                    />
                  </div>
                  <label className="flex items-center gap-1.5 pb-2 text-xs">
                    <input type="checkbox" checked={imapSecure} onChange={(e) => setImapSecure(e.target.checked)} />
                    SSL
                  </label>
                </div>
                <div className="grid grid-cols-[1fr,80px,auto] items-end gap-2">
                  <div>
                    <label className={lbl}>SMTP-Server</label>
                    <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Port</label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      className={input}
                    />
                  </div>
                  <label className="flex items-center gap-1.5 pb-2 text-xs">
                    <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
                    SSL
                  </label>
                </div>
              </div>
            )}

            {feedback && (
              <p
                className={`rounded-lg px-3 py-2 text-xs ${
                  feedback.ok
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10'
                }`}
              >
                {feedback.msg}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={save}
                disabled={!valid || busy !== false}
                className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === 'save' ? 'Speichern…' : 'Speichern'}
              </button>
              <button
                onClick={test}
                disabled={!valid || busy !== false}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
              >
                {busy === 'test' ? 'Teste…' : 'Verbindung testen'}
              </button>
              {editing && props.onDelete && a && (
                <button
                  onClick={() => props.onDelete?.(a.id)}
                  className="ml-auto text-sm text-rose-500 transition hover:text-rose-600"
                >
                  Konto entfernen
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
