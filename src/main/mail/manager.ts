import { EventEmitter } from 'events'
import { accountStore } from '../store'
import { AccountConnection } from './imapClient'
import { DemoConnection, isDemoAccount } from './demo'

export type MailConnection = AccountConnection | DemoConnection

/** Hält alle aktiven Konto-Verbindungen und leitet Events an den Renderer weiter. */
export class MailManager extends EventEmitter {
  private connections = new Map<string, MailConnection>()

  async startAll(): Promise<void> {
    for (const acc of accountStore.list()) {
      await this.startAccount(acc.id)
    }
  }

  async startAccount(id: string): Promise<void> {
    if (this.connections.has(id)) return
    const acc = accountStore.get(id)
    const conn: MailConnection =
      acc && isDemoAccount(acc.imap.host)
        ? new DemoConnection(id, this)
        : new AccountConnection(id, this)
    this.connections.set(id, conn)
    try {
      await conn.start()
    } catch (err) {
      this.emit('status', { accountId: id, state: 'error', message: (err as Error).message })
    }
  }

  async stopAccount(id: string): Promise<void> {
    const conn = this.connections.get(id)
    if (!conn) return
    this.connections.delete(id)
    await conn.stop()
  }

  async restartAccount(id: string): Promise<void> {
    await this.stopAccount(id)
    await this.startAccount(id)
  }

  get(id: string): MailConnection {
    const conn = this.connections.get(id)
    if (!conn) throw new Error(`Keine Verbindung für Konto ${id}`)
    return conn
  }

  /** Alle aktiven Konto-Verbindungen (ohne Wegwerf-Postfächer). */
  entries(): [string, MailConnection][] {
    return [...this.connections.entries()].filter(([id]) => !id.startsWith('temp:'))
  }

  async stopAll(): Promise<void> {
    await Promise.allSettled([...this.connections.values()].map((c) => c.stop()))
    this.connections.clear()
  }
}

export const mailManager = new MailManager()
