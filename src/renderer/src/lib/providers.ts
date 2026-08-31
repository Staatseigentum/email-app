export interface ProviderPreset {
  label: string
  match: RegExp
  imap: { host: string; port: number; secure: boolean }
  smtp: { host: string; port: number; secure: boolean }
  hint?: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    label: 'Gmail',
    match: /@(gmail|googlemail)\.com$/i,
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    hint: 'App-Passwort nötig (2FA aktiv) – kein normales Passwort.'
  },
  {
    label: 'Outlook / Microsoft 365',
    match: /@(outlook|hotmail|live|msn)\.[a-z.]+$/i,
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }
  },
  {
    label: 'iCloud',
    match: /@(icloud|me|mac)\.com$/i,
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    hint: 'App-spezifisches Passwort aus den Apple-ID-Einstellungen.'
  },
  {
    label: 'GMX',
    match: /@gmx\.[a-z.]+$/i,
    imap: { host: 'imap.gmx.net', port: 993, secure: true },
    smtp: { host: 'mail.gmx.net', port: 465, secure: true },
    hint: 'IMAP/POP-Zugriff im GMX-Webmailer aktivieren.'
  },
  {
    label: 'web.de',
    match: /@web\.de$/i,
    imap: { host: 'imap.web.de', port: 993, secure: true },
    smtp: { host: 'smtp.web.de', port: 587, secure: false },
    hint: 'IMAP-Zugriff in den web.de-Einstellungen aktivieren.'
  },
  {
    label: 'Yahoo',
    match: /@(yahoo|ymail)\.[a-z.]+$/i,
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    hint: 'App-Passwort erforderlich.'
  },
  {
    label: 'Zoho',
    match: /@zoho\.[a-z.]+$/i,
    imap: { host: 'imap.zoho.eu', port: 993, secure: true },
    smtp: { host: 'smtp.zoho.eu', port: 465, secure: true }
  }
]

export function detectProvider(email: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.match.test(email.trim()))
}
