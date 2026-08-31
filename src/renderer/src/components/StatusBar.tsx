import type { ConnectionStatus } from '../../../shared/types'
import { formatTime } from '../lib/format'

const DOT: Record<ConnectionStatus['state'], string> = {
  online: 'bg-ok',
  connecting: 'bg-warn',
  offline: 'bg-ink-mute',
  error: 'bg-bad'
}

const WORD: Record<ConnectionStatus['state'], string> = {
  online: 'IDLE aktiv',
  connecting: 'verbindet …',
  offline: 'offline',
  error: 'Fehler'
}

export function StatusBar(props: {
  state: ConnectionStatus['state']
  message?: string
  server?: string
  lastSync?: string
  unread: number
  accountCount: number
  onReconnect?: () => void
  onCommand?: () => void
}): JSX.Element {
  const error = props.state === 'error'
  return (
    <footer
      className={`flex h-7 shrink-0 items-center gap-2.5 border-t border-line bg-chrome px-4 text-2xs ${
        error ? 'text-bad' : 'text-ink-soft'
      }`}
    >
      <span className={`h-[7px] w-[7px] rounded-full ${DOT[props.state]}`} />
      {error ? (
        <>
          <span className="truncate">{props.message || 'Verbindungsfehler'}</span>
          {props.onReconnect && (
            <button onClick={props.onReconnect} className="text-accent-text hover:underline">
              Erneut verbinden
            </button>
          )}
        </>
      ) : (
        <>
          {props.server && (
            <span className="font-mono text-ink-soft">
              {props.server} · {WORD[props.state]}
            </span>
          )}
          {props.lastSync && (
            <span className="text-ink-mute">Letzter Abruf {formatTime(props.lastSync)}</span>
          )}
        </>
      )}

      <span className="ml-auto font-mono text-ink-mute">
        {props.unread} ungelesen · {props.accountCount}{' '}
        {props.accountCount === 1 ? 'Konto' : 'Konten'}
      </span>
      <span className="h-3 w-px bg-line-control" />
      <button onClick={props.onCommand} className="text-ink-mute hover:text-ink">
        <span className="font-mono">Strg K</span> für Befehle
      </button>
    </footer>
  )
}
