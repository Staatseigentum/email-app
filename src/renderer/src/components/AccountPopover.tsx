import { useEffect, useRef } from 'react'
import type { ConnectionStatus, MailAccount } from '../../../shared/types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { overline } from '../lib/ui'

const STATE: Record<ConnectionStatus['state'], { dot: string; word: string }> = {
  online: { dot: 'bg-ok', word: 'online' },
  connecting: { dot: 'bg-warn', word: 'verbindet' },
  offline: { dot: 'bg-ink-mute', word: 'offline' },
  error: { dot: 'bg-bad', word: 'Fehler' }
}

export function AccountPopover(props: {
  accounts: MailAccount[]
  statuses: Record<string, ConnectionStatus['state']>
  activeAccountId: string | null
  unreadByAccount: Record<string, number>
  onSelect: (id: string) => void
  onAdd: () => void
  onManage: () => void
  onClose: () => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) props.onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [props])

  return (
    <div
      ref={ref}
      className="animate-fade-in absolute left-[68px] top-11 z-50 w-[300px] rounded-lg border border-line-control bg-chrome shadow-popover"
    >
      <p className={`${overline} px-3 pb-1.5 pt-2.5`}>Konten</p>
      <div className="pb-1">
        {props.accounts.map((acc) => {
          const active = acc.id === props.activeAccountId
          const st = STATE[props.statuses[acc.id] ?? 'connecting']
          const unread = props.unreadByAccount[acc.id] ?? 0
          return (
            <button
              key={acc.id}
              onClick={() => {
                props.onSelect(acc.id)
                props.onClose()
              }}
              className={`relative flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                active ? 'bg-accent-soft' : 'hover:bg-chrome-2'
              }`}
            >
              {active && <span className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-0.5 bg-accent" />}
              <Avatar name={acc.label} size={32} emphasis={active} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{acc.label}</span>
                <span className="block truncate font-mono text-2xs text-ink-mute">{acc.email}</span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                {unread > 0 && (
                  <span className="font-mono text-xs text-ink-soft">{unread}</span>
                )}
                <span className="flex items-center gap-1 text-2xs text-ink-mute">
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {st.word}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="border-t border-line p-1.5">
        <button
          onClick={() => {
            props.onAdd()
            props.onClose()
          }}
          className="flex h-[30px] w-full items-center gap-2.5 rounded-[3px] px-2 text-sm text-ink-soft transition hover:bg-chrome-2 hover:text-ink"
        >
          <Icon name="plus" size={14} /> Konto hinzufügen
        </button>
        <button
          onClick={() => {
            props.onManage()
            props.onClose()
          }}
          className="flex h-[30px] w-full items-center gap-2.5 rounded-[3px] px-2 text-sm text-ink-soft transition hover:bg-chrome-2 hover:text-ink"
        >
          <Icon name="settings" size={14} /> Konten verwalten
        </button>
      </div>
    </div>
  )
}
