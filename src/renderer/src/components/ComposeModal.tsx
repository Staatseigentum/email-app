import { useEffect, useRef, useState } from 'react'
import type {
  ComposePayload,
  DraftPayload,
  DraftSaved,
  MailAccount,
  OutgoingAttachment
} from '../../../shared/types'
import { formatBytes } from '../lib/format'
import { modalOverlay } from '../lib/ui'
import { IconFile, IconPaperclip, IconSend, IconX } from './Icons'

const api = window.mailwave

export interface ComposeSeed {
  accountId: string
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  body?: string
  attachments?: OutgoingAttachment[]
  inReplyTo?: string
  references?: string
  /** UID eines bestehenden Entwurfs, der hier bearbeitet wird. */
  draftUid?: number
}

interface Attachment extends OutgoingAttachment {
  size: number
}

const MAX_TOTAL = 20 * 1024 * 1024

async function toAttachment(file: File): Promise<Attachment> {
  const buf = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return {
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    contentBase64: btoa(binary),
    size: file.size
  }
}

export function ComposeModal(props: {
  seed: ComposeSeed
  accounts: MailAccount[]
  draftsPath?: string
  onClose: () => void
  onSend: (payload: ComposePayload) => Promise<void>
  onSaveDraft?: (payload: DraftPayload) => Promise<DraftSaved | null>
}): JSX.Element {
  const [accountId, setAccountId] = useState(props.seed.accountId)
  const [to, setTo] = useState(props.seed.to ?? '')
  const [cc, setCc] = useState(props.seed.cc ?? '')
  const [bcc, setBcc] = useState(props.seed.bcc ?? '')
  const [showCc, setShowCc] = useState(Boolean(props.seed.cc || props.seed.bcc))
  const [subject, setSubject] = useState(props.seed.subject ?? '')
  const [body, setBody] = useState(props.seed.body ?? '')
  const [attachments, setAttachments] = useState<Attachment[]>(
    (props.seed.attachments ?? []).map((a) => ({
      ...a,
      size: Math.floor((a.contentBase64.length * 3) / 4)
    }))
  )
  const [dragging, setDragging] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const draftUid = useRef(props.seed.draftUid ?? 0)
  const sentRef = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const totalSize = attachments.reduce((s, a) => s + a.size, 0)
  const canSend = to.trim().length > 0 && !sending

  const payload = (): DraftPayload => ({
    accountId,
    to,
    cc,
    bcc,
    subject,
    text: body,
    inReplyTo: props.seed.inReplyTo,
    references: props.seed.references,
    replaceUid: draftUid.current || undefined,
    attachments: attachments.map(({ filename, contentType, contentBase64 }) => ({
      filename,
      contentType,
      contentBase64
    }))
  })

  // Automatisches Speichern in den Entwürfe-Ordner
  useEffect(() => {
    if (!props.onSaveDraft) return
    if (sentRef.current) return
    const empty =
      !to.trim() && !cc.trim() && !bcc.trim() && !subject.trim() && !body.trim() && attachments.length === 0
    if (empty) return
    const t = setTimeout(async () => {
      setDraftState('saving')
      const res = await props.onSaveDraft?.(payload())
      if (res && res.uid) draftUid.current = res.uid
      setDraftState(res ? 'saved' : 'idle')
    }, 2500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, cc, bcc, subject, body, attachments, accountId])

  async function addFiles(files: FileList | File[]): Promise<void> {
    const added = await Promise.all(Array.from(files).map(toAttachment))
    setAttachments((prev) => [...prev, ...added])
  }

  async function submit(): Promise<void> {
    setSending(true)
    setError(null)
    try {
      await props.onSend({
        accountId,
        to,
        cc,
        bcc,
        subject,
        text: body,
        inReplyTo: props.seed.inReplyTo,
        references: props.seed.references,
        attachments: attachments.map(({ filename, contentType, contentBase64 }) => ({
          filename,
          contentType,
          contentBase64
        }))
      })
      sentRef.current = true
      if (draftUid.current && props.draftsPath) {
        void api.mail.remove(accountId, props.draftsPath, draftUid.current)
      }
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
      <div className={modalOverlay} onClick={props.onClose} />
      <div className="animate-scale-in relative flex h-[600px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#141a2b]">
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

        <div
          className={`relative flex min-h-0 flex-1 flex-col ${
            dragging ? 'ring-2 ring-inset ring-brand-500/40' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files)
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Nachricht schreiben…"
            className="flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-slate-400"
          />
          {dragging && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-brand-500/5 text-sm font-medium text-brand-600">
              Dateien hier ablegen
            </div>
          )}
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2.5 dark:border-white/5">
            {attachments.map((a, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 py-1 pl-2 pr-1 text-xs dark:bg-white/5"
              >
                <IconFile width={12} height={12} className="shrink-0 text-slate-400" />
                <span className="max-w-[180px] truncate">{a.filename}</span>
                <span className="text-slate-400">{formatBytes(a.size)}</span>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-white/10"
                >
                  <IconX width={11} height={11} />
                </button>
              </span>
            ))}
            {totalSize > MAX_TOTAL && (
              <span className="w-full text-xs text-rose-500">
                Anhänge zusammen {formatBytes(totalSize)} – viele Server lehnen über ~25 MB ab.
              </span>
            )}
          </div>
        )}

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
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            title="Datei anhängen"
          >
            <IconPaperclip width={14} height={14} />
            Anhängen
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          {props.onSaveDraft && draftState !== 'idle' && (
            <span className="ml-auto text-xs text-slate-400">
              {draftState === 'saving' ? 'Entwurf wird gespeichert …' : 'Entwurf gespeichert'}
            </span>
          )}
          <button
            onClick={props.onClose}
            className={`${
              props.onSaveDraft && draftState !== 'idle' ? '' : 'ml-auto'
            } text-sm text-slate-500 transition hover:text-slate-800 dark:hover:text-white`}
          >
            {draftUid.current ? 'Schließen' : 'Verwerfen'}
          </button>
        </div>
      </div>
    </div>
  )
}
