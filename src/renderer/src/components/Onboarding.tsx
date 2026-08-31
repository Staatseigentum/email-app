import { Icon } from './Icon'
import { LogoTile, Wordmark } from './Logo'

export function Onboarding(props: {
  onAdd: () => void
  onDemo: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}): JSX.Element {
  return (
    <div className="drag relative flex h-full w-full flex-col items-center justify-center bg-window px-6 text-center">
      <button
        onClick={props.onToggleTheme}
        className="no-drag absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-[3px] text-ink-mute transition hover:bg-accent-soft hover:text-ink"
      >
        <Icon name={props.theme === 'dark' ? 'sun' : 'moon'} size={16} />
      </button>

      <div className="no-drag flex max-w-[480px] flex-col items-center">
        <LogoTile size={64} />
        <div className="mt-4">
          <Wordmark size={27} />
        </div>
        <p className="mt-2 text-base leading-normal text-ink-soft">
          Mehrere IMAP-Postfächer in einem Fenster. Passwörter bleiben lokal im
          System-Schlüsselbund.
        </p>
        <button
          onClick={props.onAdd}
          className="mt-6 flex h-[38px] items-center gap-2 rounded-[3px] bg-accent px-5 text-sm font-semibold text-accent-on shadow-glow transition-[filter,transform] duration-[80ms] hover:bg-accent-hover active:translate-y-px"
        >
          <Icon name="plus" size={15} />
          Konto hinzufügen
        </button>
        <button
          onClick={props.onDemo}
          className="mt-3 text-sm font-medium text-accent-text transition hover:underline"
        >
          Erst ohne Konto ausprobieren
        </button>

        <div className="mt-6 flex flex-col gap-1.5 text-xs text-ink-mute">
          <span className="flex items-center gap-2">
            <Icon name="shield-check" size={14} /> Keine Cloud, kein Tracking
          </span>
          <span className="flex items-center gap-2">
            <Icon name="bell" size={14} /> Benachrichtigung bei neuer Post
          </span>
          <span className="flex items-center gap-2">
            <Icon name="command" size={14} /> Alles per Tastatur
          </span>
        </div>
      </div>
    </div>
  )
}
