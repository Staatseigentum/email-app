import { useEffect } from 'react'
import { IconCheck, IconInbox, IconX } from './Icons'

export type ToastTone = 'info' | 'success' | 'error'

export interface Toast {
  id: string
  text: string
  tone?: ToastTone
  action?: { label: string; onClick: () => void }
}

const TONE: Record<ToastTone, { ring: string; icon: JSX.Element }> = {
  info: { ring: 'ring-brand-500/30', icon: <IconInbox width={15} height={15} /> },
  success: { ring: 'ring-emerald-500/30', icon: <IconCheck width={15} height={15} /> },
  error: { ring: 'ring-rose-500/40', icon: <IconX width={15} height={15} /> }
}

function ToastCard(props: { toast: Toast; onClose: (id: string) => void }): JSX.Element {
  const { toast } = props
  const tone = TONE[toast.tone ?? 'info']

  const { onClose } = props
  useEffect(() => {
    const ms = toast.tone === 'error' ? 7000 : 4500
    const t = setTimeout(() => onClose(toast.id), ms)
    return () => clearTimeout(t)
  }, [toast.id, toast.tone, onClose])

  return (
    <div
      className={`animate-slide-in-right pointer-events-auto flex items-start gap-3 rounded-xl bg-white px-3.5 py-3 text-sm shadow-xl shadow-slate-900/10 ring-1 ${tone.ring} dark:bg-[#161d30] dark:shadow-black/50`}
    >
      <span
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
          toast.tone === 'error'
            ? 'bg-rose-500/15 text-rose-500'
            : toast.tone === 'success'
              ? 'bg-emerald-500/15 text-emerald-500'
              : 'bg-brand-500/15 text-brand-500'
        }`}
      >
        {tone.icon}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="leading-snug text-slate-700 dark:text-slate-200">{toast.text}</p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick()
              props.onClose(toast.id)
            }}
            className="mt-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => props.onClose(toast.id)}
        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
      >
        <IconX width={13} height={13} />
      </button>
    </div>
  )
}

export function Toasts(props: {
  toasts: Toast[]
  onClose: (id: string) => void
}): JSX.Element {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2">
      {props.toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={props.onClose} />
      ))}
    </div>
  )
}
