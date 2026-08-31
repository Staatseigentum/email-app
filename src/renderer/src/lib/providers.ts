export interface ProviderPreset {
  id: string
  label: string
  color: string
  /** E-Mail-Domains, die diesen Anbieter automatisch auswählen. */
  match: RegExp
  imap: { host: string; port: number; secure: boolean }
  smtp: { host: string; port: number; secure: boolean }
  /** true = Nutzer braucht ein App-Passwort statt des normalen Passworts. */
  appPassword?: boolean
  hint?: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    color: '#ea4335',
    match: /@(gmail|googlemail)\.com$/i,
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    appPassword: true,
    hint: 'Google verlangt ein App-Passwort: myaccount.google.com → Sicherheit → 2-Schritt-Verifizierung → App-Passwörter.'
  },
  {
    id: 'outlook',
    label: 'Outlook',
    color: '#0078d4',
    match: /@(outlook|hotmail|live|msn)\.[a-z.]+$/i,
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    hint: 'Bei aktivierter 2FA ein App-Passwort in den Microsoft-Kontoeinstellungen erzeugen.'
  },
  {
    id: 'gmx',
    label: 'GMX',
    color: '#1c449b',
    match: /@gmx\.[a-z.]+$/i,
    imap: { host: 'imap.gmx.net', port: 993, secure: true },
    smtp: { host: 'mail.gmx.net', port: 465, secure: true },
    hint: 'Im GMX-Webmailer unter Einstellungen → POP3/IMAP den IMAP-Zugriff aktivieren.'
  },
  {
    id: 'webde',
    label: 'web.de',
    color: '#ffd800',
    match: /@web\.de$/i,
    imap: { host: 'imap.web.de', port: 993, secure: true },
    smtp: { host: 'smtp.web.de', port: 587, secure: false },
    hint: 'Im web.de-Webmailer unter Einstellungen → POP3/IMAP-Abruf aktivieren.'
  },
  {
    id: 'icloud',
    label: 'iCloud',
    color: '#3693f3',
    match: /@(icloud|me|mac)\.com$/i,
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    appPassword: true,
    hint: 'App-spezifisches Passwort auf account.apple.com → Anmeldung & Sicherheit erzeugen.'
  },
  {
    id: 'yahoo',
    label: 'Yahoo',
    color: '#6001d2',
    match: /@(yahoo|ymail)\.[a-z.]+$/i,
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    appPassword: true,
    hint: 'Yahoo verlangt ein App-Passwort (Konto-Sicherheit → App-Passwort generieren).'
  },
  {
    id: 'tonline',
    label: 'T-Online',
    color: '#e20074',
    match: /@(t-online|magenta)\.de$/i,
    imap: { host: 'secureimap.t-online.de', port: 993, secure: true },
    smtp: { host: 'securesmtp.t-online.de', port: 465, secure: true },
    hint: 'Ggf. ein separates E-Mail-Passwort im Telekom-Kundencenter setzen.'
  },
  {
    id: 'mailbox',
    label: 'mailbox.org',
    color: '#2f6f4f',
    match: /@mailbox\.org$/i,
    imap: { host: 'imap.mailbox.org', port: 993, secure: true },
    smtp: { host: 'smtp.mailbox.org', port: 465, secure: true }
  },
  {
    id: 'posteo',
    label: 'Posteo',
    color: '#1a7d3c',
    match: /@posteo\.[a-z.]+$/i,
    imap: { host: 'posteo.de', port: 993, secure: true },
    smtp: { host: 'posteo.de', port: 465, secure: true }
  },
  {
    id: 'zoho',
    label: 'Zoho',
    color: '#e42527',
    match: /@zoho\.[a-z.]+$/i,
    imap: { host: 'imap.zoho.eu', port: 993, secure: true },
    smtp: { host: 'smtp.zoho.eu', port: 465, secure: true }
  }
]

export function detectProvider(email: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.match.test(email.trim()))
}

export function providerById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id)
}
