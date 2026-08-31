import type { MailwaveApi } from './index'

declare global {
  interface Window {
    mailwave: MailwaveApi
  }
}

export {}
