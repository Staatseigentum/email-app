import { Fragment } from 'react'
import type { MessageSummary } from '../../../shared/types'
import { Avatar } from './Avatar'
import { dateGroup, formatDate } from '../lib/format'
import { IconCheck, IconCheckAll, IconPaperclip, IconStar, IconTrash } from './Icons'

export type Density = 'compact' | 'cozy'

export function MessageList(props: {
  messages: MessageSummary[]
  loading: boolean
  selectedUid: number | null
  density: Density
  checked: Set<number>
  readOnly?: boolean
  onSelect: (uid: number) => void
  onToggleCheck: (uid: number) => void
  onClearChecked: () => void
  onBulkMarkSeen: () => void
  onBulkDelete: () => void
  onToggleFlag: (uid: number, value: boolean) => void
  onDelete: (uid: number) => void
}): JSX.Element {
  const cozy = props.density === 'cozy'
  const readOnly = props.readOnly ?? false
  const anyChecked = !readOnly && props.checked.size > 0

  let lastGroup = ''

  return (
    <div className="flex w-[380px] shrink-0 flex-col border-r border-slate-200 dark:border-white/10">
      {anyChecked && (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-brand-500/5 px-3 py-2 text-xs dark:border-white/10">
          <span className="font-semibold text-brand-600 dark:text-brand-300">
            {props.checked.size} ausgewählt
          </span>
          <button
            onClick={props.onBulkMarkSeen}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 font-medium text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <IconCheckAll width={13} height={13} /> Gelesen
          </button>
          <button
            onClick={props.onBulkDelete}
            className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-slate-600 transition hover:bg-white hover:text-rose-500 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <IconTrash width={13} height={13} /> Löschen
          </button>
          <button
            onClick={props.onClearChecked}
            className="rounded-md px-2 py-1 text-slate-400 hover:text-slate-600"
          >
            Aufheben
          </button>
        </div>
      )}

      {props.loading && (
        <div className="h-0.5 w-full overflow-hidden bg-brand-500/20">
          <div className="h-full w-1/4 animate-loading bg-brand-500" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {props.loading && props.messages.length === 0 && (
          <div className="space-y-px">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
                  <div className="h-2.5 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!props.loading && props.messages.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">Keine Nachrichten</p>
        )}

        {props.messages.map((m) => {
          const selected = m.uid === props.selectedUid
          const isChecked = props.checked.has(m.uid)
          const group = dateGroup(m.date)
          const showGroup = group !== lastGroup
          lastGroup = group
          return (
            <Fragment key={m.uid}>
              {showGroup && (
                <div className="sticky top-0 z-[1] bg-slate-100/90 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur dark:bg-[#0b0f1a]/90">
                  {group}
                </div>
              )}
              <div
                onClick={() => props.onSelect(m.uid)}
                className={`group relative cursor-pointer border-b border-slate-100 pr-4 transition dark:border-white/5 ${
                  cozy ? 'py-3' : 'py-2'
                } ${
                  selected
                    ? 'bg-brand-500/10'
                    : isChecked
                      ? 'bg-brand-500/[0.06]'
                      : 'hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
                }`}
              >
                {!m.seen && (
                  <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-500" />
                )}
                <div className="flex gap-3 pl-4">
                  <div
                    className="relative flex items-center"
                    onClick={(e) => {
                      if (readOnly) return
                      e.stopPropagation()
                      props.onToggleCheck(m.uid)
                    }}
                  >
                    <span
                      className={`grid place-items-center rounded-md border transition ${
                        cozy ? 'h-9 w-9' : 'h-7 w-7'
                      } ${
                        isChecked
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : readOnly
                            ? 'border-transparent'
                            : 'border-transparent group-hover:border-slate-300 dark:group-hover:border-white/20'
                      }`}
                    >
                      {isChecked ? (
                        <IconCheck width={14} height={14} />
                      ) : (
                        <Avatar name={m.fromName} seed={m.fromAddress} size={cozy ? 34 : 26} />
                      )}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`truncate text-sm ${
                          m.seen
                            ? 'font-medium text-slate-600 dark:text-slate-300'
                            : 'font-bold'
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
                    {cozy && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {m.hasAttachments && (
                          <IconPaperclip
                            width={12}
                            height={12}
                            className="shrink-0 text-slate-400"
                          />
                        )}
                        <span className="truncate text-xs text-slate-400">{m.snippet}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className={`absolute right-3 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100 ${
                    readOnly ? 'hidden' : ''
                  }`}
                >
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
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
