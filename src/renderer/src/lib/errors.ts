/** Übersetzt technische IMAP/SMTP-Fehler in eine verständliche Handlungsanweisung. */
export function friendlyMailError(raw: string, opts?: { appPassword?: boolean }): string {
  const e = raw.toLowerCase()

  if (
    e.includes('authenticationfailed') ||
    e.includes('invalid credentials') ||
    e.includes('login failed') ||
    e.includes('auth failed') ||
    e.includes('username and password not accepted') ||
    e.includes('535') ||
    e.includes('authentication unsuccessful')
  ) {
    return opts?.appPassword
      ? 'Anmeldung abgelehnt. Dieser Anbieter braucht ein App-Passwort – nicht dein normales Passwort. Über „Seite öffnen" oben eines erstellen und hier einfügen.'
      : 'Anmeldung abgelehnt – Benutzername oder Passwort stimmt nicht. Bei aktivierter Zwei-Faktor-Anmeldung brauchst du ein App-Passwort.'
  }

  if (
    e.includes('imap') &&
    (e.includes('disabled') || e.includes('not enabled') || e.includes('not allowed'))
  ) {
    return 'IMAP ist für dieses Postfach noch nicht freigeschaltet. Über „Seite öffnen" oben im Webmailer aktivieren.'
  }

  if (e.includes('enotfound') || e.includes('eai_again')) {
    return 'Server nicht gefunden. Serveradresse prüfen (Tippfehler?) oder Internetverbindung testen.'
  }
  if (e.includes('etimedout') || e.includes('timeout') || e.includes('zeitüber')) {
    return 'Zeitüberschreitung. Firewall/VPN blockiert evtl. den Port, oder der Server ist gerade nicht erreichbar.'
  }
  if (e.includes('econnrefused')) {
    return 'Verbindung abgelehnt. Port oder SSL-Einstellung passt nicht (993/SSL für IMAP, 465/SSL oder 587 für SMTP).'
  }
  if (e.includes('certificate') || e.includes('self-signed') || e.includes('altnames')) {
    return 'Zertifikatsproblem beim Server. Serveradresse prüfen; bei eigenem Mailserver ggf. Zertifikat korrigieren.'
  }
  if (e.includes('starttls') || e.includes('wrong version number') || e.includes('ssl')) {
    return 'SSL/TLS passt nicht zum Port. Faustregel: Port 993/465 = SSL an, Port 587 = SSL aus.'
  }

  return raw
}
