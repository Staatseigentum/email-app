import { initials } from '../lib/format'

/**
 * Quadratische Initialen-Kachel (Radius 3px), keine Farbverläufe, keine bunten Kreise.
 * `emphasis` hebt ungelesene / aktive Zeilen dezent hervor.
 */
export function Avatar({
  name,
  size = 36,
  emphasis = false
}: {
  name: string
  seed?: string
  size?: number
  emphasis?: boolean
}): JSX.Element {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-[3px] font-semibold ${
        emphasis ? 'bg-chrome-3 text-accent-strong' : 'bg-chrome-2 text-ink-soft'
      }`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </div>
  )
}
