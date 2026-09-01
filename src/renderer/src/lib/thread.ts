import type { MessageSummary } from '../../../shared/types'

export interface Thread {
  /** Stabiler Schlüssel des Threads. */
  key: string
  /** Neueste Nachricht zuerst. */
  messages: MessageSummary[]
  /** = messages[0], die neueste. */
  latest: MessageSummary
  subject: string
  unread: number
  flagged: boolean
  hasAttachments: boolean
}

/** Betreff ohne Re:/Fwd:/AW:-Präfixe, klein geschrieben. */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(\s*(re|aw|antw|fwd|fw|wg)\s*(\[\d+\])?\s*:\s*)+/i, '')
    .trim()
    .toLowerCase()
}

/**
 * Fasst eine flache Nachrichtenliste zu Threads zusammen.
 * Verknüpft über References/Message-ID, Fallback: normalisierter Betreff.
 */
export function buildThreads(messages: MessageSummary[]): Thread[] {
  const parent = new Map<string, string>() // union-find
  const find = (x: string): string => {
    let root = x
    while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!
    while (parent.get(x) && parent.get(x) !== root) {
      const next = parent.get(x)!
      parent.set(x, root)
      x = next
    }
    return root
  }
  const union = (a: string, b: string): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  const idOf = (m: MessageSummary): string => m.messageId || `uid:${m.accountId ?? ''}:${m.uid}`
  const subjectKey = new Map<string, string>() // normSubject -> repräsentativer Knoten

  for (const m of messages) {
    const id = idOf(m)
    if (!parent.has(id)) parent.set(id, id)
    for (const ref of m.references ?? []) {
      if (!parent.has(ref)) parent.set(ref, ref)
      union(id, ref)
    }
    const ns = normalizeSubject(m.subject)
    if (ns) {
      const rep = subjectKey.get(ns)
      if (rep) union(id, rep)
      else subjectKey.set(ns, id)
    }
  }

  const groups = new Map<string, MessageSummary[]>()
  for (const m of messages) {
    const root = find(idOf(m))
    const list = groups.get(root) ?? []
    list.push(m)
    groups.set(root, list)
  }

  const threads: Thread[] = []
  for (const [key, list] of groups) {
    list.sort((a, b) => +new Date(b.date) - +new Date(a.date))
    threads.push({
      key,
      messages: list,
      latest: list[0],
      subject: list[0].subject,
      unread: list.filter((m) => !m.seen).length,
      flagged: list.some((m) => m.flagged),
      hasAttachments: list.some((m) => m.hasAttachments)
    })
  }
  threads.sort((a, b) => +new Date(b.latest.date) - +new Date(a.latest.date))
  return threads
}
