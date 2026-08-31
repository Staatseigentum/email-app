/** Gemeinsame Tailwind-Klassenbausteine – neues Design-System (Violett, Tokens). */

export const input =
  'w-full rounded-[3px] border border-line-control bg-well px-3 py-2 text-sm text-ink shadow-well outline-none ' +
  'transition placeholder:text-ink-mute focus:border-accent/50 focus:ring-2 focus:ring-accent-soft'

export const label =
  'mb-1 block text-2xs font-medium uppercase tracking-[0.09em] text-ink-mute'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-[3px] bg-accent px-4 text-sm font-semibold text-accent-on ' +
  'shadow-glow transition-[filter,transform] duration-[80ms] hover:bg-accent-hover active:translate-y-px ' +
  'disabled:cursor-not-allowed disabled:opacity-45'

export const btnGhost =
  'inline-flex items-center gap-1.5 rounded-[3px] border border-line-control px-3 py-1.5 text-xs font-medium text-ink-soft ' +
  'transition hover:border-line-hover hover:text-ink disabled:opacity-45'

export const btnOutline =
  'inline-flex items-center gap-1.5 rounded-[3px] border border-line-control px-3 text-sm font-medium text-ink ' +
  'transition hover:border-line-hover disabled:opacity-45'

export const iconBtn =
  'grid place-items-center rounded-[3px] text-ink-mute transition hover:bg-accent-soft hover:text-ink ' +
  'disabled:opacity-45'

export const modalOverlay = 'fixed inset-0 bg-[var(--scrim)] backdrop-blur-[3px]'

export const card = 'rounded-lg border border-line bg-panel'

export const dialog =
  'animate-dialog-in relative flex flex-col overflow-hidden rounded-xl border border-line-control bg-chrome shadow-dialog'

export const overline = 'text-2xs font-medium uppercase tracking-[0.09em] text-ink-mute'
