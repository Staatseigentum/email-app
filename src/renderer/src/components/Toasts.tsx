import { useEffect } from 'react'
import { Icon, type IconName } from './Icon'

export type ToastTone = 'info' | 'success' | 'error'

export interface Toast {
  id: string
  text: string
  title?: string
  tone?: ToastTone
  action?: { label: string; onClick: () => void }
  /** Bleibt stehen, bis er programmatisch geschlossen wird. */
  sticky?: boolean
}

const TONE: Record<ToastTone, { icon: IconName; color: string }> = {
  info: { icon: 'info', color: 'text-info' },
  success: { icon: 'check-circle', color: 'text-ok' },
  error: { icon: 'alert-triangle', color: 'text-bad' }
}

function ToastCard(props: { toast: Toast; onClose: (id: string) => void }): JSX.Element {
  const { toast, onClose } = props
  const tone = TONE[toast.tone ?? 'info']

  useEffect(() => {
    if (toast.sticky) return
    const ms = toast.tone === 'error' ? 7000 : 4500
    const t = setTimeout(() => onClose(toast.id), ms)
    return () => clearTimeout(t)
  }, [toast.id, toast.tone, toast.sticky, onClose])

  return (
    <div className="animate-toast-in pointer-events-auto flex w-[340px] items-start gap-2.5 rounded-lg border border-line bg-chrome p-3 shadow-popover">
      <Icon name={tone.icon} size={16} className={`mt-0.5 shrink-0 ${tone.color}`} />
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-xs font-semibold text-ink">{toast.title}</p>}
        <p className="text-xs leading-snug text-ink-soft">{toast.text}</p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick()
              onClose(toast.id)
            }}
            className="mt-1 text-2xs font-semibold text-accent-text hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="shrink-0 rounded-[3px] p-0.5 text-ink-mute transition hover:text-ink"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

export function Toasts(props: { toasts: Toast[]; onClose: (id: string) => void }): JSX.Element {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex flex-col gap-3">
      {props.toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={props.onClose} />
      ))}
    </div>
  )
}
