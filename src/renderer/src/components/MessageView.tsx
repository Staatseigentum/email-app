import { useMemo } from 'react'
import type { MessageDetail } from '../../../shared/types'
import { Avatar } from './Avatar'
import { formatBytes, formatFullDate } from '../lib/format'
import { IconPaperclip, IconReply, IconSend, IconTrash } from './Icons'

function buildSrcDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'; font-src data:;">
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 16px; font-family: Inter, 'Segoe UI', system-ui, sans-serif; font-size: 14px; line-height: 1.6; color: #0f172a; background: #fff; word-break: break-word; }
  @media (prefers-color-scheme: dark) { body { color: #e2e8f0; background: #0f1421; } }
  img { max-width: 100%; height: auto; }
  a { color: #3563ff; }
  blockquote { border-left: 3px solid rgba(148,163,184,.5); margin: .5rem 0; padding-left: .75rem; color: #64748b; }
  table { max-width: 100%; }
</style></head><body>${html}</body></html>`
}

export function MessageView(props: {
  detail: MessageDetail | null
  loading: boolean
  hasSelection: boolean
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onDelete: () => void
  onOpenExternal: (url: string) => void
}): JSX.Element {
  const { detail } = props

  const srcDoc = useMemo(
    () => (detail?.html ? buildSrcDoc(detail.html) : null),
    [detail?.html, detail?.uid]
  )

  if (!props.hasSelection) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-slate-400">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-200/60 dark:bg-white/5">
          <IconSend width={26} height={26} />
        </div>
        <p className="text-sm">Wähle eine Nachricht aus, um sie zu lesen</p>
      </div>
    )
  }

  if (props.loading || !detail) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        Nachricht wird geladen…
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-white/10">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-lg font-bold leading-snug">{detail.subject}</h2>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={props.onReply}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              <IconReply width={14} height={14} /> Antworten
            </button>
            <button
              onClick={props.onReplyAll}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              Allen
            </button>
            <button
              onClick={props.onForward}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
            >
              Weiterleiten
            </button>
            <button
              onClick={props.onDelete}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-rose-300 hover:text-rose-500 dark:border-white/10"
              title="Löschen"
            >
              <IconTrash width={14} height={14} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Avatar name={detail.fromName} seed={detail.fromAddress} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold">{detail.fromName}</span>
              <span className="truncate text-xs text-slate-400">&lt;{detail.fromAddress}&gt;</span>
            </div>
            <div className="truncate text-xs text-slate-400">
              an {detail.to.join(', ') || '—'}
              {detail.cc.length > 0 && ` · Cc: ${detail.cc.join(', ')}`}
            </div>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{formatFullDate(detail.date)}</span>
        </div>

        {detail.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.attachments.map((a, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs dark:bg-white/5"
              >
                <IconPaperclip width={12} height={12} className="text-slate-400" />
                {a.filename}
                <span className="text-slate-400">{formatBytes(a.size)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {srcDoc ? (
          <iframe
            title="E-Mail-Inhalt"
            sandbox=""
            srcDoc={srcDoc}
            className="h-full w-full border-0 bg-white dark:bg-[#0f1421]"
          />
        ) : (
          <pre className="mail-html h-full overflow-y-auto whitespace-pre-wrap px-6 py-5 font-sans text-sm">
            {detail.text || '(kein Inhalt)'}
          </pre>
        )}
      </div>
    </div>
  )
}
