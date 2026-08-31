export function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays < 7) {
    return d.toLocaleDateString('de-DE', { weekday: 'short' })
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
  }
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** Kompakt fürs Maschinen-Setting im Leseansicht-Kopf: „Fr 17.05. · 09:41". */
export function formatMetaDate(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_COLORS = [
  '#3563ff',
  '#12b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#f97316'
]

export function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/** Grobe Zeitgruppe für Listen-Zwischenüberschriften. */
export function dateGroup(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const t = d.getTime()
  if (t >= startOfToday) return 'Heute'
  if (t >= startOfToday - 86_400_000) return 'Gestern'
  if (t >= startOfToday - 7 * 86_400_000) return 'Diese Woche'
  if (d.getFullYear() === now.getFullYear())
    return d.toLocaleDateString('de-DE', { month: 'long' })
  return String(d.getFullYear())
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
