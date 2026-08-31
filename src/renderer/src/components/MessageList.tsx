import type { MessageSummary } from '../../../shared/types'
import { Avatar } from './Avatar'
import { formatDate } from '../lib/format'
import { IconPaperclip, IconStar, IconTrash } from './Icons'

export function MessageList(props: {
  messages: MessageSummary[]
  loading: boolean
  selectedUid: number | null
  onSelect: (uid: number) => void
  onToggleFlag: (uid: number, value: boolean) => void
  onDelete: (uid: number) => void
}): JSX.Element {
  return (
    <div className="flex w-[380px] shrink-0 flex-col border-r border-slate-200 dark:border-white/10">
      {props.loading && (
        <div className="h-0.5 w-full overflow-hidden bg-brand-500/20">
          <div className="h-full w-1/4 animate-loading bg-brand-500" />
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {!props.loading && props.messages.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">Keine Nachrichten</p>
        )}
        {props.messages.map((m) => {
          const selected = m.uid === props.selectedUid
          return (
            <div
              key={m.uid}
              onClick={() => props.onSelect(m.uid)}
              className={`group relative cursor-pointer border-b border-slate-100 px-4 py-3 transition dark:border-white/5 ${
                selected
                  ? 'bg-brand-500/10'
                  : 'hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex gap-3">
                <div className="relative">
                  <Avatar name={m.fromName} seed={m.fromAddress} size={38} />
                  {!m.seen && (
                    <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-brand-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`truncate text-sm ${
                        m.seen ? 'font-medium text-slate-600 dark:text-slate-300' : 'font-bold'
                      }`}
                    >
                      {m.fromName}
                    </span>
                    <span className="ml-auto shrink-0 text-[11px] text-slate-400">
                      {formatDate(m.date)}
                    </span>
                  </div>
                  <div
                    className={`truncate text-[13px] ${
                      m.seen ? 'text-slate-500 dark:text-slate-400' : 'font-semibold'
                    }`}
                  >
                    {m.subject}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {m.hasAttachments && (
                      <IconPaperclip width={12} height={12} className="shrink-0 text-slate-400" />
                    )}
                    <span className="truncate text-xs text-slate-400">{m.snippet}</span>
                  </div>
                </div>
              </div>

              <div className="absolute right-3 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onToggleFlag(m.uid, !m.flagged)
                  }}
                  className={`rounded-md bg-white/80 p-1.5 shadow-sm backdrop-blur transition hover:text-amber-500 dark:bg-slate-800/80 ${
                    m.flagged ? 'text-amber-500' : 'text-slate-400'
                  }`}
                  title="Markieren"
                >
                  <IconStar width={14} height={14} fill={m.flagged ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onDelete(m.uid)
                  }}
                  className="rounded-md bg-white/80 p-1.5 text-slate-400 shadow-sm backdrop-blur transition hover:text-rose-500 dark:bg-slate-800/80"
                  title="Löschen"
                >
                  <IconTrash width={14} height={14} />
                </button>
              </div>

              {m.flagged && (
                <span className="absolute right-3 top-3 text-amber-500 group-hover:hidden">
                  <IconStar width={14} height={14} fill="currentColor" />
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
