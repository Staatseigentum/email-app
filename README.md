# MailWave

Ein moderner Desktop-E-Mail-Client auf Basis von **Electron + React + TypeScript + Tailwind**.

## Funktionen

- **Mehrere Konten** – beliebig viele IMAP/SMTP-Postfächer parallel, jedes mit eigener
  Absenderadresse und -name. Serverdaten für Gmail, Outlook, iCloud, GMX, web.de, Yahoo
  und Zoho werden anhand der E-Mail-Adresse automatisch erkannt.
- **E-Mails schreiben & senden** – Verfassen-Fenster mit An/Cc/Bcc, Antworten, Allen
  antworten und Weiterleiten (inkl. Zitat).
- **Posteingang lesen** – Ordnerliste mit Ungelesen-Zählern, Nachrichtenliste mit
  Vorschau, HTML-Ansicht in einer abgeschotteten Sandbox, Anhänge-Übersicht.
- **Desktop-Benachrichtigungen** – dauerhafte IMAP-IDLE-Verbindung pro Konto; bei neuer
  Post erscheint eine native System-Benachrichtigung, Klick fokussiert das Fenster.
- **Nachrichten verwalten** – als gelesen/ungelesen markieren, mit Stern versehen, löschen.
- **Modernes UI** – Hell-/Dunkelmodus, Akzentfarben pro Konto, flüssige Übergänge.
- **Sichere Ablage** – Passwörter werden lokal über den System-Schlüsselbund
  (`safeStorage`) verschlüsselt; keine Cloud, kein Tracking.

## Entwicklung

```bash
npm install
npm run dev        # Hot-Reload-Entwicklung
npm run typecheck  # TypeScript prüfen
npm run build      # Produktions-Bundle nach out/
npm start          # gebautes Bundle starten
```

## Paketieren

```bash
npm run pack   # entpacktes Verzeichnis (release/)
npm run dist   # Installer (NSIS / dmg / AppImage)
```

## Architektur

| Ebene | Ort | Aufgabe |
| --- | --- | --- |
| Main | `src/main` | App-Lifecycle, Fenster, IPC, Konto-Speicher |
| Mail | `src/main/mail` | IMAP (`imapflow`) inkl. IDLE, SMTP-Versand (`nodemailer`), Parsing (`mailparser`) |
| Preload | `src/preload` | schmale, typisierte Bridge (`window.mailwave`) über `contextBridge` |
| Renderer | `src/renderer` | React-UI |
| Shared | `src/shared` | Typen und IPC-Kanalnamen für Main + Renderer |

### Hinweise

- Bei Anbietern mit 2-Faktor-Authentifizierung (Gmail, iCloud, Yahoo …) ein
  **App-Passwort** verwenden, nicht das normale Kontopasswort.
- Manche integrierten Editor-Terminals setzen `ELECTRON_RUN_AS_NODE=1`. Der Wrapper
  `scripts/evite.mjs` entfernt die Variable vor dem Start – sonst startet Electron nur
  als reines Node.
