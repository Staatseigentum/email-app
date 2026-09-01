import { Fragment, useMemo, type RefObject, type UIEvent } from 'react'
import type { MessageSummary } from '../../../shared/types'
import { Avatar } from './Avatar'
import { dateGroup, formatDate } from '../lib/format'
import { buildThreads } from '../lib/thread'
import { Icon } from './Icon'

export type Density = 'compact' | 'cozy'
export type ListFilter = 'all' | 'unread' | 'flagged' | 'attachments'

const FILTERS: { key: ListFilter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'unread', label: 'Ungelesen' },
  { key: 'flagged', label: 'Markiert' },
  { key: 'attachments', label: 'Anhänge' }
]

interface RowActions {
  selecting: boolean
  readOnly: boolean
  selectedUid: number | null
  checked: Set<number>
  accountColors?: Record<string, string>
  showAccountDot?: boolean
  onSelect: (uid: number) => void
  onToggleCheck: (uid: number) => void
  onToggleFlag: (uid: number, value: boolean) => void
  onDelete: (uid: number) => void
  onArchive?: (uid: number) => void
}

function MessageRow(props: RowActions & { m: MessageSummary; indent?: boolean }): JSX.Element {
  const { m } = props
  const selected = m.uid === props.selectedUid
  const isChecked = props.checked.has(m.uid)
  const dot = props.showAccountDot && m.accountId ? props.accountColors?.[m.accountId] : undefined
  return (
    <div
      onClick={() => (props.selecting ? props.onToggleCheck(m.uid) : props.onSelect(m.uid))}
      className={`group relative cursor-pointer border-b border-line py-3 pr-3 transition ${
        props.indent ? 'pl-7' : 'pl-3'
      } ${selected ? 'bg-accent-soft' : isChecked ? 'bg-accent-soft/60' : 'hover:bg-chrome-2'}`}
    >
      {selected && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
      <div className="flex gap-2.5 pl-1">
        <div className="relative shrink-0">
          {!m.seen && !props.selecting && (
            <span className="absolute -left-1.5 top-3 h-2 w-2 rounded-full bg-accent" />
          )}
          {props.selecting ? (
            <span
              className={`grid h-9 w-9 place-items-center rounded-[3px] border transition ${
                isChecked ? 'border-accent bg-accent text-white' : 'border-line-hover text-transparent'
              }`}
            >
              <Icon name="check" size={14} />
            </span>
          ) : (
            <Avatar name={m.fromName} size={36} emphasis={!m.seen || selected} />
          )}
          {dot && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-canvas"
              style={{ background: dot }}
            />
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
          <div className={`truncate text-sm ${m.seen ? 'text-ink-soft' : 'font-medium text-ink'}`}>
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
      {!props.selecting && !props.readOnly && (
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          {props.onArchive && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                props.onArchive?.(m.uid)
              }}
              title="Archivieren"
              className="grid h-6 w-6 place-items-center rounded-[3px] bg-chrome-2 text-ink-soft transition hover:text-accent-text"
            >
              <Icon name="archive" size={13} />
            </button>
          )}
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
  )
}

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
  inputRef?: RefObject<HTMLInputElement>
  threaded?: boolean
  onToggleThreaded?: () => void
  expandedThreads?: Set<string>
  onToggleThread?: (key: string) => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  accountColors?: Record<string, string>
  showAccountDot?: boolean
  onSearchSubmit?: () => void
  searchScope?: 'mailbox' | 'all'
  onToggleScope?: () => void
  searchActive?: boolean
  onQuery: (v: string) => void
  onFilter: (f: ListFilter) => void
  onSync: () => void
  onMarkAllSeen?: () => void
  onToggleSelectMode: () => void
  onSelect: (uid: number) => void
  onToggleCheck: (uid: number) => void
  onClearChecked: () => void
  onBulkMarkSeen: () => void
  onBulkDelete: () => void
  onBulkArchive?: () => void
  onToggleFlag: (uid: number, value: boolean) => void
  onDelete: (uid: number) => void
  onArchive?: (uid: number) => void
}): JSX.Element {
  const readOnly = props.readOnly ?? false
  const selecting = props.selectMode && !readOnly
  const hasUnread = props.messages.some((m) => !m.seen)
  const expanded = props.expandedThreads ?? new Set<string>()

  const threads = useMemo(
    () => (props.threaded ? buildThreads(props.messages) : null),
    [props.threaded, props.messages]
  )

  const rowActions: RowActions = {
    selecting,
    readOnly,
    selectedUid: props.selectedUid,
    checked: props.checked,
    accountColors: props.accountColors,
    showAccountDot: props.showAccountDot,
    onSelect: props.onSelect,
    onToggleCheck: props.onToggleCheck,
    onToggleFlag: props.onToggleFlag,
    onDelete: props.onDelete,
    onArchive: props.onArchive
  }

  function onScroll(e: UIEvent<HTMLDivElement>): void {
    if (!props.onLoadMore || props.loadingMore || !props.hasMore) return
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) props.onLoadMore()
  }

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
            ref={props.inputRef}
            value={props.query}
            onChange={(e) => props.onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && props.onSearchSubmit) {
                e.preventDefault()
                props.onSearchSubmit()
              }
            }}
            placeholder={
              props.onSearchSubmit
                ? 'Suchen … (Enter = auf dem Server)'
                : props.accountName
                  ? `In ${props.accountName} suchen …`
                  : 'Suchen …'
            }
            className="h-8 w-full rounded-[3px] border border-line-control bg-well pl-8 pr-2 text-sm text-ink shadow-well outline-none placeholder:text-ink-mute focus:border-accent/50 focus:ring-2 focus:ring-accent-soft"
          />
        </div>
        {props.onToggleThreaded && !selecting && (
          <button
            onClick={props.onToggleThreaded}
            title={props.threaded ? 'Threads aus' : 'Nach Konversation gruppieren'}
            className={`grid h-8 w-8 place-items-center rounded-[3px] border transition ${
              props.threaded
                ? 'border-accent bg-accent-soft text-accent-text'
                : 'border-line-control text-ink-soft hover:border-line-hover hover:text-ink'
            }`}
          >
            <Icon name="layers" size={14} />
          </button>
        )}
        {props.onMarkAllSeen && hasUnread && !selecting && (
          <button
            onClick={props.onMarkAllSeen}
            title="Alle als gelesen markieren"
            className="grid h-8 w-8 place-items-center rounded-[3px] border border-line-control text-ink-soft transition hover:border-line-hover hover:text-ink"
          >
            <Icon name="mail-check" size={14} />
          </button>
        )}
        {!readOnly && (
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
        )}
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
            {props.onBulkArchive && (
              <button
                onClick={props.onBulkArchive}
                title="Archivieren"
                className="grid h-6 w-6 place-items-center rounded-[3px] text-ink-soft hover:bg-chrome-2 hover:text-accent-text"
              >
                <Icon name="archive" size={14} />
              </button>
            )}
            <button
              onClick={props.onBulkDelete}
              title="Löschen"
              className="grid h-6 w-6 place-items-center rounded-[3px] text-ink-soft hover:bg-chrome-2 hover:text-bad"
            >
              <Icon name="trash-2" size={14} />
            </button>
            <button onClick={props.onClearChecked} className="ml-1 text-ink-mute hover:text-ink">
              Aufheben
            </button>
          </div>
        </div>
      ) : props.searchActive ? (
        <div className="flex h-[38px] shrink-0 items-center gap-2 border-y border-line bg-chrome px-3 text-xs text-ink-soft">
          <Icon name="search" size={13} />
          <span>{props.messages.length} Treffer</span>
          {props.onToggleScope && (
            <button
              onClick={props.onToggleScope}
              className="ml-auto rounded-full bg-accent-soft px-2.5 py-0.5 text-accent-strong"
            >
              {props.searchScope === 'all' ? 'Alle Ordner' : 'Aktueller Ordner'}
            </button>
          )}
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

      <div className="flex-1 overflow-y-auto" onScroll={onScroll}>
        {!props.loading && props.messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Icon name="inbox" size={20} className="text-ink-mute" />
            <p className="text-sm text-ink-mute">
              {props.query
                ? `Keine Treffer für „${props.query}".`
                : 'Keine Nachrichten in diesem Ordner.'}
            </p>
          </div>
        )}

        {threads
          ? threads.map((t) => {
              const group = dateGroup(t.latest.date)
              const showGroup = group !== lastGroup
              lastGroup = group
              const open = expanded.has(t.key)
              return (
                <Fragment key={t.key}>
                  {showGroup && (
                    <div className="px-3 pb-1.5 pt-2.5 text-2xs font-medium uppercase tracking-[0.09em] text-ink-mute">
                      {group}
                    </div>
                  )}
                  <div className="relative">
                    <MessageRow {...rowActions} m={{ ...t.latest, seen: t.unread === 0 }} />
                    {t.messages.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          props.onToggleThread?.(t.key)
                        }}
                        title={open ? 'Thread einklappen' : `${t.messages.length} Nachrichten`}
                        className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-chrome-3 px-1.5 py-0.5 font-mono text-2xs text-ink-soft"
                      >
                        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={11} />
                        {t.messages.length}
                      </button>
                    )}
                  </div>
                  {open &&
                    t.messages.slice(1).map((m) => (
                      <MessageRow key={m.uid} {...rowActions} m={m} indent />
                    ))}
                </Fragment>
              )
            })
          : props.messages.map((m) => {
              const group = dateGroup(m.date)
              const showGroup = group !== lastGroup
              lastGroup = group
              return (
                <Fragment key={`${m.accountId ?? ''}:${m.uid}`}>
                  {showGroup && (
                    <div className="px-3 pb-1.5 pt-2.5 text-2xs font-medium uppercase tracking-[0.09em] text-ink-mute">
                      {group}
                    </div>
                  )}
                  <MessageRow {...rowActions} m={m} />
                </Fragment>
              )
            })}

        {props.loadingMore && (
          <p className="py-4 text-center text-xs text-ink-mute">Weitere werden geladen …</p>
        )}
      </div>
    </div>
  )
}
