import type { Density } from './MessageList'
import {
  IconCheckAll,
  IconDensity,
  IconMoon,
  IconRefresh,
  IconSearch,
  IconSun
} from './Icons'

export function TopBar(props: {
  title: string
  subtitle?: string
  query: string
  onQuery: (v: string) => void
  onMarkAllSeen?: () => void
  canMarkAllSeen: boolean
  onSync: () => void
  density: Density
  onToggleDensity: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}): JSX.Element {
  const iconBtn =
    'no-drag rounded-lg p-2 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white'

  return (
    <header className="drag flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 px-5 dark:border-white/10">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">
          {props.title}
        </h1>
        {props.subtitle && (
          <p className="truncate text-[11px] text-slate-400">{props.subtitle}</p>
        )}
      </div>

      <div className="no-drag relative ml-auto w-72">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={props.query}
          onChange={(e) => props.onQuery(e.target.value)}
          placeholder="Suchen…"
          className="w-full rounded-lg border border-slate-200 bg-white/70 py-1.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-white/5"
        />
      </div>

      {props.onMarkAllSeen && (
        <button
          onClick={props.onMarkAllSeen}
          disabled={!props.canMarkAllSeen}
          className="no-drag flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          title="Alle als gelesen markieren"
        >
          <IconCheckAll width={14} height={14} />
          Alle gelesen
        </button>
      )}

      <button
        onClick={props.onToggleDensity}
        className={iconBtn}
        title={props.density === 'cozy' ? 'Kompakte Ansicht' : 'Komfortable Ansicht'}
      >
        <IconDensity />
      </button>
      <button onClick={props.onSync} className={iconBtn} title="Aktualisieren">
        <IconRefresh />
      </button>
      <button onClick={props.onToggleTheme} className={iconBtn} title="Design wechseln">
        {props.theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>
    </header>
  )
}
