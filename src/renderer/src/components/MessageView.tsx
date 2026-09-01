import { useEffect, useMemo, useRef, useState } from 'react'
import type { MessageDetail } from '../../../shared/types'
import { Avatar } from './Avatar'
import { formatBytes, formatMetaDate } from '../lib/format'
import { Icon } from './Icon'

const REMOTE_RE = /(?:src|background)\s*=\s*["']?https?:|url\(\s*["']?https?:/i

function buildSrcDoc(html: string, dark: boolean, blockRemote: boolean): string {
  const fg = dark ? '#c2c8e6' : '#14183a'
  const bg = dark ? '#030408' : '#ffffff'
  const link = dark ? '#c3a9ff' : '#6b2fd6'
  const quote = dark ? '#9aa3cd' : '#4b5280'
  const border = dark ? 'rgba(154,163,205,.32)' : 'rgba(42,25,88,.24)'
  const imgSrc = blockRemote ? 'data:' : 'data: https: http:'
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'; font-src data:;">
<base target="_blank">
<style>
  :root { color-scheme: ${dark ? 'dark' : 'light'}; }
  html, body { height: auto; }
  body { margin: 0; padding: 20px 22px; font-family: 'DM Sans','Segoe UI',system-ui,sans-serif; font-size: 15px; line-height: 1.65; color: ${fg}; background: ${bg}; word-break: break-word; overflow-wrap: anywhere; text-wrap: pretty; }
  img, video { max-width: 100% !important; height: auto; }
  a { color: ${link}; }
  blockquote { border-left: 2px solid ${border}; margin: .5rem 0; padding-left: .75rem; color: ${quote}; }
  table { max-width: 100% !important; }
</style></head><body>${html}</body></html>`
}

export function MessageView(props: {
  detail: MessageDetail | null
  loading: boolean
  hasSelection: boolean
  theme: 'dark' | 'light'
  blockRemote?: boolean
  onAllowRemote?: () => void
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onDelete: () => void
  onArchive?: () => void
  onToggleFlag?: (value: boolean) => void
  onOpenExternal: (url: string) => void
  onSaveAttachment: (index: number) => Promise<void>
  onPreviewAttachment?: (
    index: number
  ) => Promise<{ filename: string; contentType: string; base64: string }>
  readOnly?: boolean
}): JSX.Element {
  const { detail } = props
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [showRemote, setShowRemote] = useState(false)
  const [preview, setPreview] = useState<{ url: string; filename: string; pdf: boolean } | null>(null)
  const [previewBusy, setPreviewBusy] = useState<number | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [frameHeight, setFrameHeight] = useState(320)
  const [frameWidth, setFrameWidth] = useState<number | null>(null)

  // Maße + Remote-Freigabe bei Nachrichtenwechsel zurücksetzen
  useEffect(() => {
    setFrameHeight(320)
    setFrameWidth(null)
    setShowRemote(false)
    setPreview(null)
  }, [detail?.uid])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  const hasRemote = useMemo(
    () => (detail?.html ? REMOTE_RE.test(detail.html) : false),
    [detail?.html, detail?.uid]
  )
  const blocking = Boolean(props.blockRemote) && hasRemote && !showRemote

  function fitFrame(): void {
    const doc = frameRef.current?.contentDocument
    if (!doc?.body) return
    const h = Math.max(doc.body.scrollHeight, doc.documentElement?.scrollHeight ?? 0)
    if (h > 0) setFrameHeight((prev) => (Math.abs(prev - (h + 4)) > 1 ? h + 4 : prev))
    const w = Math.max(doc.body.scrollWidth, doc.documentElement?.scrollWidth ?? 0)
    setFrameWidth((prev) => {
      if (w <= 0) return prev
      return prev !== null && Math.abs(prev - w) <= 1 ? prev : w
    })
  }

  function handleFrameLoad(): void {
    fitFrame()
    const doc = frameRef.current?.contentDocument
    if (!doc) return
    doc.addEventListener('click', (e) => {
      const anchor = (e.target as HTMLElement | null)?.closest('a')
      const href = anchor?.getAttribute('href')
      if (href && /^https?:/i.test(href)) {
        e.preventDefault()
        props.onOpenExternal(href)
      }
    })
    doc.querySelectorAll('img').forEach((img) => {
      if (!img.complete) {
        img.addEventListener('load', fitFrame, { once: true })
        img.addEventListener('error', fitFrame, { once: true })
      }
    })
    observerRef.current?.disconnect()
    try {
      const ro = new ResizeObserver(() => fitFrame())
      ro.observe(doc.body)
      observerRef.current = ro
    } catch {
      /* ResizeObserver nicht verfügbar */
    }
    setTimeout(fitFrame, 300)
    setTimeout(fitFrame, 1200)
  }

  async function saveAttachment(index: number): Promise<void> {
    setSavingIndex(index)
    try {
      await props.onSaveAttachment(index)
    } finally {
      setSavingIndex(null)
    }
  }

  async function openPreview(index: number, contentType: string): Promise<void> {
    if (!props.onPreviewAttachment) return
    setPreviewBusy(index)
    try {
      const data = await props.onPreviewAttachment(index)
      const url = `data:${data.contentType || contentType};base64,${data.base64}`
      setPreview({ url, filename: data.filename, pdf: /pdf/i.test(data.contentType || contentType) })
    } finally {
      setPreviewBusy(null)
    }
  }

  const srcDoc = useMemo(
    () => (detail?.html ? buildSrcDoc(detail.html, props.theme === 'dark', blocking) : null),
    [detail?.html, detail?.uid, props.theme, blocking]
  )

  if (!props.hasSelection) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-window text-center">
        <Icon name="mail-open" size={20} className="text-ink-mute" />
        <p className="text-sm text-ink-mute">Wähle links eine Nachricht.</p>
      </div>
    )
  }

  if (props.loading || !detail) {
    return (
      <div className="flex flex-1 items-center justify-center bg-window text-sm text-ink-mute">
        Nachricht wird geladen …
      </div>
    )
  }

  const ghost =
    'grid h-8 w-8 place-items-center rounded-[3px] text-ink-soft transition hover:bg-accent-soft hover:text-ink'

  const canPreview = (ct: string, name: string): boolean =>
    /^image\//i.test(ct) || /pdf/i.test(ct) || /\.(png|jpe?g|gif|webp|bmp|svg|pdf)$/i.test(name)

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-window">
      {!props.readOnly && (
        <div className="flex h-[52px] shrink-0 items-center gap-1.5 border-b border-line px-4">
          <button
            onClick={props.onReply}
            className="flex h-8 items-center gap-1.5 rounded-[3px] border border-line-control px-3 text-sm font-medium text-ink transition hover:border-line-hover"
          >
            <Icon name="reply" size={14} /> Antworten
          </button>
          <button
            onClick={props.onReplyAll}
            className="flex h-8 items-center gap-1.5 rounded-[3px] px-2.5 text-sm text-ink-soft transition hover:bg-accent-soft hover:text-ink"
          >
            <Icon name="reply-all" size={14} /> Allen
          </button>
          <button
            onClick={props.onForward}
            className="flex h-8 items-center gap-1.5 rounded-[3px] px-2.5 text-sm text-ink-soft transition hover:bg-accent-soft hover:text-ink"
          >
            <Icon name="forward" size={14} /> Weiterleiten
          </button>
          <span className="mx-1.5 h-[18px] w-px bg-line-control" />
          {props.onArchive && (
            <button onClick={props.onArchive} className={ghost} title="Archivieren (E)">
              <Icon name="archive" size={15} />
            </button>
          )}
          <button
            onClick={() => props.onToggleFlag?.(!detail.flagged)}
            className={`${ghost} ${detail.flagged ? 'text-warn' : ''}`}
            title="Markieren"
          >
            <Icon name="star" size={15} />
          </button>
          <button onClick={props.onDelete} className={`${ghost} hover:text-bad`} title="Löschen">
            <Icon name="trash-2" size={15} />
          </button>
          <span className="ml-auto font-mono text-2xs text-ink-mute">R · S</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[640px] px-7 pt-6">
          <h1 className="font-display text-xl font-semibold tracking-[-0.012em] text-ink">
            {detail.subject || '(kein Betreff)'}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            <Avatar name={detail.fromName || detail.fromAddress} size={40} emphasis />
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-ink">
                {detail.fromName || detail.fromAddress}
              </div>
              <div className="truncate font-mono text-xs text-ink-mute">{detail.fromAddress}</div>
            </div>
            <span className="shrink-0 font-mono text-xs text-ink-mute">
              {formatMetaDate(detail.date)}
            </span>
          </div>
          <div className="mt-1 truncate text-xs text-ink-mute">
            an <span className="font-mono">{detail.to.join(', ') || '—'}</span>
            {detail.cc.length > 0 && (
              <>
                {' · Cc '}
                <span className="font-mono">{detail.cc.join(', ')}</span>
              </>
            )}
          </div>

          {blocking && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-chrome px-3 py-2 text-xs text-ink-soft">
              <Icon name="shield-check" size={14} className="text-accent-text" />
              <span className="flex-1">Externe Inhalte (Bilder, Tracker) blockiert.</span>
              <button
                onClick={() => setShowRemote(true)}
                className="rounded-[3px] border border-line-control px-2 py-1 text-ink transition hover:border-line-hover"
              >
                Anzeigen
              </button>
              {props.onAllowRemote && (
                <button
                  onClick={props.onAllowRemote}
                  className="rounded-[3px] px-2 py-1 text-ink-mute transition hover:text-ink"
                >
                  Absender immer erlauben
                </button>
              )}
            </div>
          )}

          {detail.attachments.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-2xs font-medium uppercase tracking-[0.09em] text-ink-mute">
                Anhänge · {detail.attachments.length}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {detail.attachments.map((a) => {
                  const previewable = !props.readOnly && props.onPreviewAttachment && canPreview(a.contentType, a.filename)
                  return (
                    <div
                      key={a.index}
                      className="flex w-[220px] items-center gap-2.5 rounded-lg border border-line bg-chrome p-2 text-left"
                    >
                      <button
                        onClick={() =>
                          previewable ? openPreview(a.index, a.contentType) : saveAttachment(a.index)
                        }
                        disabled={savingIndex !== null || previewBusy !== null}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-[3px] bg-accent-soft text-accent-text disabled:opacity-60"
                        title={previewable ? 'Vorschau' : 'Speichern'}
                      >
                        <Icon
                          name={
                            previewBusy === a.index
                              ? 'spinner'
                              : previewable
                                ? 'external-link'
                                : 'file-text'
                          }
                          size={15}
                          className={previewBusy === a.index ? 'animate-spin-slow' : ''}
                        />
                      </button>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-ink">
                          {a.filename}
                        </span>
                        <span className="block font-mono text-2xs text-ink-mute">
                          {formatBytes(a.size)}
                        </span>
                      </span>
                      <button
                        onClick={() => saveAttachment(a.index)}
                        disabled={savingIndex !== null}
                        title="Speichern"
                        className="shrink-0 text-ink-mute transition hover:text-ink disabled:opacity-60"
                      >
                        <Icon
                          name={savingIndex === a.index ? 'spinner' : 'download'}
                          size={13}
                          className={savingIndex === a.index ? 'animate-spin-slow' : ''}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {srcDoc ? (
          <div className="mt-5 overflow-x-auto px-4 pb-6">
            <iframe
              ref={frameRef}
              title="E-Mail-Inhalt"
              sandbox="allow-same-origin"
              srcDoc={srcDoc}
              onLoad={handleFrameLoad}
              scrolling="no"
              style={{ height: frameHeight, width: frameWidth ?? '100%', minWidth: '100%' }}
              className="block rounded-lg border border-line"
            />
          </div>
        ) : (
          <div className="mx-auto max-w-[640px] px-7 pb-6">
            <pre className="mail-html mt-5 whitespace-pre-wrap font-sans text-base text-ink">
              {detail.text || '(kein Inhalt)'}
            </pre>
          </div>
        )}

        {!props.readOnly && (
          <div className="mx-auto max-w-[640px] px-7 pb-6">
            <button
              onClick={props.onReply}
              className="flex w-full items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2.5 text-left text-sm text-ink-mute transition hover:border-line-hover"
            >
              <Icon name="corner-up-left" size={15} />
              <span className="flex-1">Kurz antworten …</span>
              <span className="rounded-[3px] border border-line-control px-1.5 py-0.5 font-mono text-2xs">
                R
              </span>
            </button>
          </div>
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-[var(--scrim)] p-6 backdrop-blur-[3px]"
          onClick={() => setPreview(null)}
        >
          <div className="mb-3 flex items-center gap-3 text-sm text-white">
            <Icon name="paperclip" size={14} />
            <span className="flex-1 truncate">{preview.filename}</span>
            <button
              onClick={() => setPreview(null)}
              className="grid h-8 w-8 place-items-center rounded-[3px] bg-white/10 text-white transition hover:bg-white/20"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
            {preview.pdf ? (
              <iframe
                title={preview.filename}
                src={preview.url}
                className="h-full w-full rounded-lg border-0 bg-white"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <img
                  src={preview.url}
                  alt={preview.filename}
                  className="max-h-full max-w-full rounded-lg object-contain"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
