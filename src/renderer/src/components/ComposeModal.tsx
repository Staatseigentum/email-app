import { useState } from 'react'
import type { ComposePayload, MailAccount } from '../../../shared/types'
import { IconSend, IconX } from './Icons'

export interface ComposeSeed {
  accountId: string
  to?: string
  cc?: string
  subject?: string
  body?: string
}

export function ComposeModal(props: {
  seed: ComposeSeed
  accounts: MailAccount[]
  onClose: () => void
  onSend: (payload: ComposePayload) => Promise<void>
}): JSX.Element {
  const [accountId, setAccountId] = useState(props.seed.accountId)
  const [to, setTo] = useState(props.seed.to ?? '')
  const [cc, setCc] = useState(props.seed.cc ?? '')
  const [bcc, setBcc] = useState('')
  const [showCc, setShowCc] = useState(Boolean(props.seed.cc))
  const [subject, setSubject] = useState(props.seed.subject ?? '')
  const [body, setBody] = useState(props.seed.body ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSend = to.trim().length > 0 && !sending

  async function submit(): Promise<void> {
    setSending(true)
    setError(null)
    try {
      await props.onSend({ accountId, to, cc, bcc, subject, text: body })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const field =
    'w-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-slate-400'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={props.onClose}
      />
      <div className="animate-fade-in relative flex h-[560px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#141a2b]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <h3 className="text-sm font-semibold">Neue Nachricht</h3>
          <button
            onClick={props.onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"
          >
            <IconX width={16} height={16} />
          </button>
        </div>

        <div className="flex items-center border-b border-slate-100 dark:border-white/5">
          <span className="pl-4 text-xs text-slate-400">Von</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
          >
            {props.accounts.map((a) => (
              <option key={a.id} value={a.id} className="text-slate-900">
                {a.name} &lt;{a.email}&gt;
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center border-b border-slate-100 dark:border-white/5">
          <span className="pl-4 text-xs text-slate-400">An</span>
          <input
            autoFocus
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="empfaenger@example.com"
            className={field}
          />
          {!showCc && (
            <button
              onClick={() => setShowCc(true)}
              className="pr-4 text-xs text-slate-400 hover:text-slate-600"
            >
              Cc/Bcc
            </button>
          )}
        </div>

        {showCc && (
          <>
            <div className="flex items-center border-b border-slate-100 dark:border-white/5">
              <span className="pl-4 text-xs text-slate-400">Cc</span>
              <input value={cc} onChange={(e) => setCc(e.target.value)} className={field} />
            </div>
            <div className="flex items-center border-b border-slate-100 dark:border-white/5">
              <span className="pl-4 text-xs text-slate-400">Bcc</span>
              <input value={bcc} onChange={(e) => setBcc(e.target.value)} className={field} />
            </div>
          </>
        )}

        <div className="flex items-center border-b border-slate-100 dark:border-white/5">
          <span className="pl-4 text-xs text-slate-400">Betreff</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={field}
          />
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Nachricht schreiben…"
          className="flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-slate-400"
        />

        {error && (
          <p className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-3 dark:border-white/10">
          <button
            onClick={submit}
            disabled={!canSend}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconSend width={15} height={15} />
            {sending ? 'Senden…' : 'Senden'}
          </button>
          <button
            onClick={props.onClose}
            className="text-sm text-slate-500 transition hover:text-slate-800 dark:hover:text-white"
          >
            Verwerfen
          </button>
        </div>
      </div>
    </div>
  )
}
