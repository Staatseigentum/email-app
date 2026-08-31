import type { ConnectionStatus, MailAccount, MailboxNode } from '../../../shared/types'
import {
  IconArchive,
  IconInbox,
  IconPencil,
  IconPlus,
  IconSend,
  IconSettings,
  IconStar,
  IconTrash
} from './Icons'

const STATUS_COLOR: Record<ConnectionStatus['state'], string> = {
  online: 'bg-emerald-500',
  connecting: 'bg-amber-400 animate-pulse',
  offline: 'bg-slate-400',
  error: 'bg-rose-500'
}

function mailboxIcon(box: MailboxNode): JSX.Element {
  const key = (box.specialUse || box.name).toLowerCase()
  if (key.includes('sent') || key.includes('gesendet')) return <IconSend />
  if (key.includes('trash') || key.includes('papierkorb') || key.includes('deleted'))
    return <IconTrash />
  if (key.includes('junk') || key.includes('spam')) return <IconArchive />
  if (key.includes('flag') || key.includes('markiert') || key.includes('star'))
    return <IconStar />
  if (key.includes('archiv')) return <IconArchive />
  return <IconInbox />
}

const ORDER = ['\\Inbox', '\\Sent', '\\Drafts', '\\Junk', '\\Trash', '\\Archive']
function sortBoxes(boxes: MailboxNode[]): MailboxNode[] {
  return [...boxes].sort((a, b) => {
    const ai = a.specialUse ? ORDER.indexOf(a.specialUse) : 99
    const bi = b.specialUse ? ORDER.indexOf(b.specialUse) : 99
    if (ai !== bi) return (ai < 0 ? 98 : ai) - (bi < 0 ? 98 : bi)
    return a.name.localeCompare(b.name)
  })
}

export function Sidebar(props: {
  accounts: MailAccount[]
  statuses: Record<string, ConnectionStatus['state']>
  activeAccountId: string | null
  onSelectAccount: (id: string) => void
  mailboxes: MailboxNode[]
  activeMailbox: string
  onSelectMailbox: (path: string) => void
  onCompose: () => void
  onAddAccount: () => void
  onEditAccount: (a: MailAccount) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}): JSX.Element {
  const active = props.accounts.find((a) => a.id === props.activeAccountId)

  return (
    <aside className="drag flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white/60 backdrop-blur dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex h-14 items-center gap-2 px-5">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white">
          <IconSend width={15} height={15} />
        </div>
        <span className="text-[15px] font-bold tracking-tight">MailWave</span>
      </div>

      <div className="no-drag px-3">
        <button
          onClick={props.onCompose}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:brightness-110 active:scale-[0.98]"
        >
          <IconPencil width={16} height={16} />
          Neue E-Mail
        </button>
      </div>

      <nav className="no-drag mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {sortBoxes(props.mailboxes).map((box) => {
          const isActive = box.path === props.activeMailbox
          return (
            <button
              key={box.path}
              onClick={() => props.onSelectMailbox(box.path)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                isActive
                  ? 'bg-brand-500/10 font-semibold text-brand-600 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-white/5'
              }`}
            >
              <span className={isActive ? 'text-brand-500' : 'text-slate-400'}>
                {mailboxIcon(box)}
              </span>
              <span className="truncate capitalize">{box.name}</span>
              {box.unseen > 0 && (
                <span className="ml-auto rounded-full bg-brand-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {box.unseen}
                </span>
              )}
            </button>
          )
        })}
        {props.mailboxes.length === 0 && (
          <p className="px-2.5 py-2 text-xs text-slate-400">Ordner werden geladen…</p>
        )}
      </nav>

      <div className="no-drag border-t border-slate-200 p-3 dark:border-white/10">
        <div className="space-y-1">
          {props.accounts.map((acc) => {
            const isActive = acc.id === props.activeAccountId
            const state = props.statuses[acc.id] ?? 'connecting'
            return (
              <div
                key={acc.id}
                className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                  isActive ? 'bg-slate-200/70 dark:bg-white/10' : 'hover:bg-slate-200/50 dark:hover:bg-white/5'
                }`}
              >
                <button
                  onClick={() => props.onSelectAccount(acc.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="relative">
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: acc.color }}
                    >
                      {acc.label.slice(0, 2).toUpperCase()}
                    </span>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#0b0f1a] ${STATUS_COLOR[state]}`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{acc.label}</span>
                    <span className="block truncate text-[11px] text-slate-400">{acc.email}</span>
                  </span>
                </button>
                <button
                  onClick={() => props.onEditAccount(acc)}
                  className="rounded p-1 text-slate-400 opacity-0 transition hover:text-slate-700 group-hover:opacity-100 dark:hover:text-white"
                  title="Konto bearbeiten"
                >
                  <IconSettings width={15} height={15} />
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex items-center gap-1">
          <button
            onClick={props.onAddAccount}
            className="flex flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <IconPlus width={14} height={14} />
            Konto hinzufügen
          </button>
          <button
            onClick={props.onToggleTheme}
            className="rounded-lg px-2 py-1.5 text-xs text-slate-500 transition hover:bg-slate-200/60 dark:hover:bg-white/5"
            title="Design wechseln"
          >
            {props.theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        {active?.name && (
          <p className="mt-1 px-2 text-[11px] text-slate-400">Absender: {active.name}</p>
        )}
      </div>
    </aside>
  )
}
