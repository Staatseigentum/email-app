import type { ConnectionStatus, MailAccount } from '../../../shared/types'
import { Icon } from './Icon'

const DOT: Record<ConnectionStatus['state'], string> = {
  online: 'bg-ok',
  connecting: 'bg-warn',
  offline: 'bg-ink-mute',
  error: 'bg-bad'
}

const STATE_WORD: Record<ConnectionStatus['state'], string> = {
  online: 'online',
  connecting: 'verbindet',
  offline: 'offline',
  error: 'Fehler'
}

function tileInitials(label: string): string {
  return label.trim().slice(0, 2).toUpperCase() || '?'
}

export function AccountRail(props: {
  accounts: MailAccount[]
  statuses: Record<string, ConnectionStatus['state']>
  activeAccountId: string | null
  unreadByAccount: Record<string, number>
  view: string
  onSelect: (id: string) => void
  onActiveClick: () => void
  onAdd: () => void
  onSettings: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}): JSX.Element {
  return (
    <nav className="drag flex w-16 shrink-0 flex-col items-center gap-2 border-r border-line bg-panel py-3">
      {props.accounts.map((acc) => {
        const active = acc.id === props.activeAccountId && props.view === 'mail'
        const state = props.statuses[acc.id] ?? 'connecting'
        const unread = props.unreadByAccount[acc.id] ?? 0
        return (
          <button
            key={acc.id}
            onClick={() => (active ? props.onActiveClick() : props.onSelect(acc.id))}
            title={`${acc.label} · ${acc.email} · ${STATE_WORD[state]}`}
            aria-label={`${acc.label} · ${acc.email} · ${STATE_WORD[state]}`}
            className="no-drag relative"
          >
            {active && (
              <span className="absolute -left-3 top-1.5 h-7 w-0.5 rounded-full bg-accent-hover" />
            )}
            <span
              className={`grid h-10 w-10 place-items-center rounded-[3px] border text-sm font-semibold transition ${
                active
                  ? 'border-accent-hover bg-accent-soft text-accent-strong shadow-glow'
                  : 'border-line-control bg-chrome-2 text-ink-soft hover:border-line-hover hover:text-ink'
              }`}
            >
              {tileInitials(acc.label)}
            </span>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel ${DOT[state]}`}
            />
            {unread > 0 && (
              <span
                className={`absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-panel px-1 font-mono text-2xs font-medium ${
                  active ? 'bg-accent text-white' : 'bg-chrome-3 text-ink-soft'
                }`}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        )
      })}

      <button
        onClick={props.onAdd}
        title="Konto hinzufügen"
        className="no-drag grid h-8 w-10 place-items-center rounded-[3px] border border-dashed border-line-hover text-ink-mute transition hover:text-ink"
      >
        <Icon name="plus" size={16} />
      </button>

      <div className="mt-auto flex flex-col items-center gap-1">
        <button
          onClick={props.onToggleTheme}
          title="Design wechseln"
          className="no-drag grid h-8 w-8 place-items-center rounded-[3px] text-ink-mute transition hover:bg-accent-soft hover:text-ink"
        >
          <Icon name={props.theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
        <button
          onClick={props.onSettings}
          title="Einstellungen"
          className="no-drag grid h-8 w-8 place-items-center rounded-[3px] text-ink-mute transition hover:bg-accent-soft hover:text-ink"
        >
          <Icon name="settings" size={16} />
        </button>
      </div>
    </nav>
  )
}
