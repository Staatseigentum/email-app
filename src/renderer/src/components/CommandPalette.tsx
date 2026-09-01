import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Icon, type IconName } from './Icon'
import { modalOverlay } from '../lib/ui'

export interface Command {
  id: string
  title: string
  /** Kürzel-Hinweis rechts, z. B. „R" oder „Strg N". */
  hint?: string
  icon: IconName
  /** Zusätzliche Suchbegriffe, die nicht im Titel stehen. */
  keywords?: string
  group: string
  run: () => void
}

export function CommandPalette(props: {
  commands: Command[]
  onClose: () => void
}): JSX.Element {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return props.commands
    const terms = s.split(/\s+/)
    return props.commands.filter((c) => {
      const hay = `${c.title} ${c.keywords ?? ''} ${c.group}`.toLowerCase()
      return terms.every((t) => hay.includes(t))
    })
  }, [q, props.commands])

  useEffect(() => setActive(0), [filtered])

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function runAt(i: number): void {
    const cmd = filtered[i]
    if (!cmd) return
    props.onClose()
    cmd.run()
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runAt(active)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      props.onClose()
    }
  }

  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh]">
      <div className={modalOverlay} onClick={props.onClose} />
      <div className="animate-dialog-in relative flex max-h-[68vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-line-control bg-chrome shadow-dialog">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Icon name="search" size={16} className="shrink-0 text-ink-mute" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Befehl, Ordner oder Konto …"
            className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-mute"
          />
          <kbd className="shrink-0 rounded-[3px] border border-line-control px-1.5 py-0.5 font-mono text-2xs text-ink-mute">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-mute">Nichts gefunden.</p>
          )}
          {filtered.map((c, i) => {
            const head = c.group !== lastGroup ? c.group : null
            lastGroup = c.group
            return (
              <div key={c.id}>
                {head && (
                  <p className="px-2.5 pb-1 pt-2 text-2xs font-medium uppercase tracking-[0.09em] text-ink-mute">
                    {head}
                  </p>
                )}
                <button
                  data-active={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => runAt(i)}
                  className={`flex w-full items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-left text-sm transition ${
                    i === active ? 'bg-accent-soft text-ink' : 'text-ink-soft'
                  }`}
                >
                  <Icon
                    name={c.icon}
                    size={15}
                    className={i === active ? 'text-accent-text' : 'text-ink-mute'}
                  />
                  <span className="flex-1 truncate">{c.title}</span>
                  {c.hint && (
                    <span className="shrink-0 font-mono text-2xs text-ink-mute">{c.hint}</span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
