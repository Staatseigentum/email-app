import { IconPlus, IconSend } from './Icons'

export function Onboarding(props: {
  onAdd: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}): JSX.Element {
  return (
    <div className="drag flex h-full w-full flex-col items-center justify-center bg-slate-100 px-6 text-center dark:bg-[#0b0f1a] dark:text-slate-100">
      <button
        onClick={props.onToggleTheme}
        className="no-drag absolute right-4 top-4 rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-white/10"
      >
        {props.theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-xl shadow-brand-600/30">
        <IconSend width={28} height={28} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Willkommen bei MailWave</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        Dein moderner Desktop-E-Mail-Client. Verbinde ein oder mehrere IMAP-Postfächer,
        schreibe neue E-Mails und erhalte Desktop-Benachrichtigungen bei neuen Nachrichten.
      </p>
      <button
        onClick={props.onAdd}
        className="no-drag mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:brightness-110 active:scale-[0.98]"
      >
        <IconPlus width={16} height={16} />
        Erstes Konto hinzufügen
      </button>
      <p className="mt-4 text-xs text-slate-400">
        Passwörter werden lokal über den System-Schlüsselbund verschlüsselt gespeichert.
      </p>
    </div>
  )
}
