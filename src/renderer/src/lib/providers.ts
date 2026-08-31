import type { OAuthProvider } from '../../../shared/types'

export interface ProviderPreset {
  id: string
  label: string
  color: string
  /** E-Mail-Domains, die diesen Anbieter automatisch auswählen. */
  match: RegExp
  imap: { host: string; port: number; secure: boolean }
  smtp: { host: string; port: number; secure: boolean }
  /** Anbieter unterstützt Browser-Login (OAuth). */
  oauth?: OAuthProvider
  /** true = Nutzer braucht ein App-Passwort statt des normalen Passworts. */
  appPassword?: boolean
  hint?: string
  /** Seite zum Aktivieren von IMAP bzw. Erstellen eines App-Passworts. */
  setupUrl?: string
  setupSteps?: string[]
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    color: '#ea4335',
    match: /@(gmail|googlemail)\.com$/i,
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    oauth: 'google',
    appPassword: true,
    setupUrl: 'https://myaccount.google.com/apppasswords',
    setupSteps: [
      'Google-Konto → Sicherheit → 2-Schritt-Verifizierung aktivieren',
      'Danach „App-Passwörter" öffnen und ein neues für „Mail" erstellen',
      'Den 16-stelligen Code hier als Passwort einfügen'
    ],
    hint: 'Empfohlen: Browser-Login. Alternativ App-Passwort (2FA erforderlich).'
  },
  {
    id: 'outlook',
    label: 'Outlook',
    color: '#0078d4',
    match: /@(outlook|hotmail|live|msn)\.[a-z.]+$/i,
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    oauth: 'microsoft',
    setupUrl: 'https://account.microsoft.com/security',
    setupSteps: [
      'Bei aktivierter 2FA: Microsoft-Konto → Sicherheit → erweiterte Sicherheitsoptionen',
      '„App-Passwörter" → neues App-Passwort erstellen',
      'Passwort hier einfügen'
    ],
    hint: 'Empfohlen: Browser-Login. Basic-Auth wird von Microsoft teils abgeschaltet.'
  },
  {
    id: 'gmx',
    label: 'GMX',
    color: '#1c449b',
    match: /@gmx\.[a-z.]+$/i,
    imap: { host: 'imap.gmx.net', port: 993, secure: true },
    smtp: { host: 'mail.gmx.net', port: 465, secure: true },
    setupUrl: 'https://hilfe.gmx.net/pop-imap/einschalten.html',
    setupSteps: [
      'GMX-Postfach im Browser öffnen → Einstellungen → POP3/IMAP',
      '„IMAP-Zugriff erlauben" aktivieren und speichern',
      'Hier deine normale GMX-E-Mail-Adresse und dein Passwort eintragen'
    ]
  },
  {
    id: 'webde',
    label: 'web.de',
    color: '#ffd800',
    match: /@web\.de$/i,
    imap: { host: 'imap.web.de', port: 993, secure: true },
    smtp: { host: 'smtp.web.de', port: 587, secure: false },
    setupUrl: 'https://hilfe.web.de/pop-imap/einschalten.html',
    setupSteps: [
      'web.de-Postfach im Browser öffnen → Einstellungen → POP3/IMAP-Abruf',
      '„IMAP-Zugriff erlauben" aktivieren und speichern',
      'Hier deine web.de-Adresse und dein Passwort eintragen'
    ]
  },
  {
    id: 'icloud',
    label: 'iCloud',
    color: '#3693f3',
    match: /@(icloud|me|mac)\.com$/i,
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    appPassword: true,
    setupUrl: 'https://account.apple.com',
    setupSteps: [
      'account.apple.com öffnen → Anmelden',
      '„Anmeldung & Sicherheit" → „App-spezifische Passwörter" → neues erzeugen',
      'Das erzeugte Passwort hier einfügen'
    ]
  },
  {
    id: 'yahoo',
    label: 'Yahoo',
    color: '#6001d2',
    match: /@(yahoo|ymail)\.[a-z.]+$/i,
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    appPassword: true,
    setupUrl: 'https://login.yahoo.com/account/security/app-passwords',
    setupSteps: [
      'Yahoo → Konto-Info → Konto-Sicherheit',
      '„App-Passwort generieren" → Name vergeben',
      'Passwort hier einfügen'
    ]
  },
  {
    id: 'tonline',
    label: 'T-Online',
    color: '#e20074',
    match: /@(t-online|magenta)\.de$/i,
    imap: { host: 'secureimap.t-online.de', port: 993, secure: true },
    smtp: { host: 'securesmtp.t-online.de', port: 465, secure: true },
    setupUrl: 'https://e-mail.t-online.de',
    setupSteps: [
      'Im Telekom-Kundencenter ggf. ein separates „E-Mail-Passwort" setzen',
      'Hier deine @t-online.de-Adresse und dieses Passwort eintragen'
    ]
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

/** IMAP/SMTP-Server für ein OAuth-Konto. */
export const OAUTH_SERVERS: Record<
  OAuthProvider,
  { imap: ProviderPreset['imap']; smtp: ProviderPreset['smtp']; label: string }
> = {
  google: {
    label: 'Google',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true }
  },
  microsoft: {
    label: 'Microsoft',
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }
  }
}

export function detectProvider(email: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.match.test(email.trim()))
}

export function providerById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id)
}
