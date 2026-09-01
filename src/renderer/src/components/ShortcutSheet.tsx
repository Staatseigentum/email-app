import { useEffect } from 'react'
import { modalOverlay } from '../lib/ui'
import { Icon } from './Icon'

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Allgemein',
    items: [
      ['Strg K', 'Befehle öffnen'],
      ['?', 'Diese Übersicht'],
      ['C', 'Neue E-Mail'],
      ['/', 'Suche'],
      ['Esc', 'Schließen / Auswahl aufheben']
    ]
  },
  {
    title: 'Liste',
    items: [
      ['J  ·  ↓', 'Nächste Nachricht'],
      ['K  ·  ↑', 'Vorherige Nachricht'],
      ['U', 'Gelesen / ungelesen'],
      ['Umschalt U', 'Alle als gelesen'],
      ['S', 'Markieren (Stern)'],
      ['E', 'Archivieren'],
      ['Entf', 'Löschen']
    ]
  },
  {
    title: 'Nachricht',
    items: [
      ['R', 'Antworten'],
      ['A', 'Allen antworten'],
      ['F', 'Weiterleiten'],
      ['Enter', 'Serversuche (im Suchfeld)']
    ]
  },
  {
    title: 'Springen',
    items: [
      ['G  dann  I', 'Posteingang'],
      ['G  dann  S', 'Gesendet'],
      ['G  dann  E', 'Entwürfe'],
      ['G  dann  T', 'Papierkorb']
    ]
  }
]

export function ShortcutSheet(props: { onClose: () => void }): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        props.onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [props.onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className={modalOverlay} onClick={props.onClose} />
      <div className="animate-dialog-in relative w-full max-w-[520px] overflow-hidden rounded-xl border border-line-control bg-chrome shadow-dialog">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <Icon name="command" size={15} className="text-ink-mute" />
          <h3 className="text-sm font-semibold text-ink">Tastaturkürzel</h3>
          <button
            onClick={props.onClose}
            className="ml-auto grid h-7 w-7 place-items-center rounded-[3px] text-ink-mute transition hover:bg-chrome-2 hover:text-ink"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-7 gap-y-5 px-5 py-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-2 text-2xs font-medium uppercase tracking-[0.09em] text-ink-mute">
                {g.title}
              </p>
              <div className="space-y-1.5">
                {g.items.map(([key, label]) => (
                  <div key={label} className="flex items-center gap-3 text-xs">
                    <kbd className="shrink-0 whitespace-nowrap rounded-[3px] border border-line-control px-1.5 py-0.5 font-mono text-2xs text-ink-soft">
                      {key}
                    </kbd>
                    <span className="text-ink-soft">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
