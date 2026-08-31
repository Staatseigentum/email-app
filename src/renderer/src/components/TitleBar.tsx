import { Icon } from './Icon'
import { LogoTile, Wordmark } from './Logo'

const api = window.mailwave

/** Eigene 40px-Titelleiste mit Fensterbuttons (native Leiste ist ausgeblendet). */
export function TitleBar({ context }: { context?: string }): JSX.Element {
  const isMac = navigator.platform.toLowerCase().includes('mac')

  return (
    <header
      className="drag flex h-10 shrink-0 items-center gap-2 border-b border-line bg-chrome px-3"
      style={isMac ? { paddingLeft: 78 } : undefined}
    >
      <LogoTile size={22} />
      <Wordmark size={13} />
      <span className="mx-1 h-3.5 w-px bg-line-control" />
      {context && <span className="truncate text-xs text-ink-soft">{context}</span>}

      {!isMac && (
        <div className="no-drag ml-auto flex items-center">
          <button
            onClick={() => api.win.minimize()}
            className="grid h-10 w-[46px] place-items-center text-ink-soft transition hover:bg-chrome-2"
            aria-label="Minimieren"
          >
            <Icon name="minus" size={15} />
          </button>
          <button
            onClick={() => api.win.maximizeToggle()}
            className="grid h-10 w-[46px] place-items-center text-ink-soft transition hover:bg-chrome-2"
            aria-label="Maximieren"
          >
            <Icon name="square" size={12} />
          </button>
          <button
            onClick={() => api.win.close()}
            className="group grid h-10 w-[46px] place-items-center text-ink-soft transition hover:bg-bad hover:text-white"
            aria-label="Schließen"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      )}
    </header>
  )
}
