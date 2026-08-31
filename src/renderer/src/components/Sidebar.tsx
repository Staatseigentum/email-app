import type { MailboxNode } from '../../../shared/types'
import { Icon, type IconName } from './Icon'
import { overline } from '../lib/ui'

const ORDER = ['\\Inbox', '\\Sent', '\\Drafts', '\\Junk', '\\Trash', '\\Archive']

const SPECIAL: Record<string, { name: string; icon: IconName }> = {
  '\\Inbox': { name: 'Posteingang', icon: 'inbox' },
  '\\Sent': { name: 'Gesendet', icon: 'send' },
  '\\Drafts': { name: 'Entwürfe', icon: 'file-text' },
  '\\Junk': { name: 'Spam', icon: 'shield-alert' },
  '\\Trash': { name: 'Papierkorb', icon: 'trash-2' },
  '\\Archive': { name: 'Archiv', icon: 'archive' }
}

function boxMeta(box: MailboxNode): { name: string; icon: IconName } {
  if (box.specialUse && SPECIAL[box.specialUse]) return SPECIAL[box.specialUse]
  const key = (box.specialUse || box.name).toLowerCase()
  if (key.includes('sent') || key.includes('gesendet')) return { name: box.name, icon: 'send' }
  if (key.includes('trash') || key.includes('papierkorb')) return { name: box.name, icon: 'trash-2' }
  if (key.includes('junk') || key.includes('spam')) return { name: box.name, icon: 'shield-alert' }
  if (key.includes('draft') || key.includes('entw')) return { name: box.name, icon: 'file-text' }
  if (key.includes('archiv')) return { name: box.name, icon: 'archive' }
  return { name: box.name, icon: 'inbox' }
}

function sortBoxes(boxes: MailboxNode[]): MailboxNode[] {
  return [...boxes].sort((a, b) => {
    const ai = a.specialUse ? ORDER.indexOf(a.specialUse) : 99
    const bi = b.specialUse ? ORDER.indexOf(b.specialUse) : 99
    if (ai !== bi) return (ai < 0 ? 98 : ai) - (bi < 0 ? 98 : bi)
    return a.name.localeCompare(b.name)
  })
}

function Row(props: {
  icon: IconName
  label: string
  count?: number
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={props.onClick}
      className={`relative flex h-[30px] w-full items-center gap-2.5 rounded-[3px] px-2 text-sm transition ${
        props.active
          ? 'bg-accent-soft font-medium text-ink'
          : 'text-ink-soft hover:bg-chrome-2 hover:text-ink'
      }`}
    >
      {props.active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
      )}
      <Icon name={props.icon} size={15} className={props.active ? 'text-accent-text' : ''} />
      <span className="truncate">{props.label}</span>
      {props.count ? (
        <span
          className={`ml-auto font-mono text-xs ${props.active ? 'text-accent-text' : 'text-ink-mute'}`}
        >
          {props.count}
        </span>
      ) : null}
    </button>
  )
}

export function Sidebar(props: {
  mailboxes: MailboxNode[]
  activeMailbox: string
  view: 'mail' | 'temp' | 'settings'
  onSelectMailbox: (path: string) => void
  onOpenTemp: () => void
  onCompose: () => void
  onOpenPalette: () => void
}): JSX.Element {
  const mailActive = props.view === 'mail'
  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="p-3">
        <button
          onClick={props.onCompose}
          className="flex h-[38px] w-full items-center justify-center gap-2 rounded-[3px] bg-accent text-sm font-semibold text-accent-on shadow-glow transition-[filter,transform] duration-[80ms] hover:bg-accent-hover active:translate-y-px"
        >
          <Icon name="pencil" size={15} />
          Neue E-Mail
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <p className={`${overline} px-2 pb-1.5 pt-1`}>Postfach</p>
        {sortBoxes(props.mailboxes).map((box) => {
          const meta = boxMeta(box)
          return (
            <Row
              key={box.path}
              icon={meta.icon}
              label={meta.name}
              count={box.unseen}
              active={mailActive && box.path === props.activeMailbox}
              onClick={() => props.onSelectMailbox(box.path)}
            />
          )
        })}
        {props.mailboxes.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-ink-mute">Ordner werden geladen …</p>
        )}

        <p className={`${overline} px-2 pb-1.5 pt-4`}>Ansichten</p>
        <Row
          icon="clock"
          label="Wegwerf-Postfach"
          active={props.view === 'temp'}
          onClick={props.onOpenTemp}
        />
      </nav>

      <button
        onClick={props.onOpenPalette}
        className="m-2 flex items-center gap-2 rounded-lg border border-line bg-chrome px-2.5 py-2 text-left text-xs text-ink-soft transition hover:border-line-hover"
      >
        <Icon name="command" size={14} />
        <span className="flex-1">Alles finden</span>
        <span className="rounded-[3px] border border-line-control px-1.5 py-0.5 font-mono text-2xs text-ink-mute">
          Strg K
        </span>
      </button>
    </aside>
  )
}
