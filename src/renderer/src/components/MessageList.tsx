import { Fragment } from 'react'
import type { MessageSummary } from '../../../shared/types'
import { Avatar } from './Avatar'
import { dateGroup, formatDate } from '../lib/format'
import { Icon } from './Icon'

export type Density = 'compact' | 'cozy'
export type ListFilter = 'all' | 'unread' | 'flagged' | 'attachments'

const FILTERS: { key: ListFilter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'unread', label: 'Ungelesen' },
  { key: 'flagged', label: 'Markiert' },
  { key: 'attachments', label: 'Anhänge' }
]

export function MessageList(props: {
  messages: MessageSummary[]
  loading: boolean
  selectedUid: number | null
  query: string
  filter: ListFilter
  accountName?: string
  checked: Set<number>
  selectMode: boolean
  readOnly?: boolean
  onQuery: (v: string) => void
  onFilter: (f: ListFilter) => void
  onSync: () => void
  onToggleSelectMode: () => void
  onSelect: (uid: number) => void
  onToggleCheck: (uid: number) => void
  onClearChecked: () => void
  onBulkMarkSeen: () => void
  onBulkDelete: () => void
  onToggleFlag: (uid: number, value: boolean) => void
  onDelete: (uid: number) => void
}): JSX.Element {
  const readOnly = props.readOnly ?? false
  const selecting = props.selectMode && !readOnly
  let lastGroup = ''

  return (
    <div className="flex w-[392px] shrink-0 flex-col border-r border-line bg-canvas">
      {/* Kopf */}
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-3">
        <div className="relative flex-1">
          <Icon
            name="search"
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mute"
          />
          <input
            value={props.query}
            onChange={(e) => props.onQuery(e.target.value)}
            placeholder={props.accountName ? `In ${props.accountName} suchen …` : 'Suchen …'}
            className="h-8 w-full rounded-[3px] border border-line-control bg-well pl-8 pr-2 text-sm text-ink shadow-well outline-none placeholder:text-ink-mute focus:border-accent/50 focus:ring-2 focus:ring-accent-soft"
          />
        </div>
        <button
          onClick={props.onToggleSelectMode}
          title="Mehrere auswählen"
          className={`grid h-8 w-8 place-items-center rounded-[3px] border transition ${
            selecting
              ? 'border-accent bg-accent-soft text-accent-text'
              : 'border-line-control text-ink-soft hover:border-line-hover hover:text-ink'
          }`}
        >
          <Icon name="check" size={14} />
        </button>
        <button
          onClick={props.onSync}
          title="Aktualisieren"
          className="grid h-8 w-8 place-items-center rounded-[3px] border border-line-control text-ink-soft transition hover:border-line-hover hover:text-ink"
        >
          <Icon name="refresh-cw" size={14} />
        </button>
      </div>

      {/* Filter / Auswahlleiste */}
      {selecting ? (
        <div className="flex h-[38px] shrink-0 items-center gap-2 border-y border-line bg-chrome px-3 text-xs">
          <span className="font-medium text-ink">{props.checked.size} ausgewählt</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={props.onBulkMarkSeen}
              title="Als gelesen"
              className="grid h-6 w-6 place-items-center rounded-[3px] text-ink-soft hover:bg-chrome-2 hover:text-ink"
            >
              <Icon name="mail-open" size={14} />
            </button>
            <button
              onClick={props.onBulkDelete}
              title="Löschen"
              className="grid h-6 w-6 place-items-center rounded-[3px] text-ink-soft hover:bg-chrome-2 hover:text-bad"
            >
              <Icon name="trash-2" size={14} />
            </button>
            <button
              onClick={props.onClearChecked}
              className="ml-1 text-ink-mute hover:text-ink"
            >
              Aufheben
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-[38px] shrink-0 items-center gap-1.5 border-y border-line px-3">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => props.onFilter(f.key)}
              className={`h-[22px] rounded-full px-2.5 text-xs transition ${
                props.filter === f.key
                  ? 'bg-accent-soft text-accent-strong'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {props.loading && (
        <div className="h-0.5 w-full shrink-0 overflow-hidden bg-accent-soft">
          <div className="h-full w-1/4 animate-loading bg-accent" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!props.loading && props.messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Icon name="inbox" size={20} className="text-ink-mute" />
            <p className="text-sm text-ink-mute">
              {props.query ? `Keine Treffer für „${props.query}".` : 'Keine Nachrichten in diesem Ordner.'}
            </p>
          </div>
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
                <div className="px-3 pb-1.5 pt-2.5 text-2xs font-medium uppercase tracking-[0.09em] text-ink-mute">
                  {group}
                </div>
              )}
              <div
                onClick={() => (selecting ? props.onToggleCheck(m.uid) : props.onSelect(m.uid))}
                className={`group relative cursor-pointer border-b border-line px-3 py-3 transition ${
                  selected ? 'bg-accent-soft' : isChecked ? 'bg-accent-soft/60' : 'hover:bg-chrome-2'
                }`}
              >
                {selected && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
                <div className="flex gap-2.5 pl-1">
                  <div className="relative shrink-0">
                    {!m.seen && !selecting && (
                      <span className="absolute -left-1.5 top-3 h-2 w-2 rounded-full bg-accent" />
                    )}
                    {selecting ? (
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-[3px] border transition ${
                          isChecked
                            ? 'border-accent bg-accent text-white'
                            : 'border-line-hover text-transparent'
                        }`}
                      >
                        <Icon name="check" size={14} />
                      </span>
                    ) : (
                      <Avatar name={m.fromName} size={36} emphasis={!m.seen || selected} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`truncate text-sm ${
                          m.seen ? 'font-normal text-ink-soft' : 'font-semibold text-ink'
                        }`}
                      >
                        {m.fromName || m.fromAddress}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-2xs text-ink-mute">
                        {formatDate(m.date)}
                      </span>
                    </div>
                    <div
                      className={`truncate text-sm ${
                        m.seen ? 'text-ink-soft' : 'font-medium text-ink'
                      }`}
                    >
                      {m.subject || '(kein Betreff)'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {m.hasAttachments && (
                        <Icon name="paperclip" size={12} className="shrink-0 text-ink-mute" />
                      )}
                      <span className="truncate text-xs text-ink-mute">{m.snippet}</span>
                    </div>
                  </div>
                </div>

                {m.flagged && (
                  <span className="absolute right-3 top-3 text-warn group-hover:hidden">
                    <Icon name="star" size={14} />
                  </span>
                )}
                {!selecting && !readOnly && (
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        props.onToggleFlag(m.uid, !m.flagged)
                      }}
                      title="Markieren"
                      className={`grid h-6 w-6 place-items-center rounded-[3px] bg-chrome-2 transition hover:text-warn ${
                        m.flagged ? 'text-warn' : 'text-ink-soft'
                      }`}
                    >
                      <Icon name="star" size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        props.onDelete(m.uid)
                      }}
                      title="Löschen"
                      className="grid h-6 w-6 place-items-center rounded-[3px] bg-chrome-2 text-ink-soft transition hover:text-bad"
                    >
                      <Icon name="trash-2" size={13} />
                    </button>
                  </div>
                )}
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
