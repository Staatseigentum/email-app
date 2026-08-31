# MailWave

Ein moderner Desktop-E-Mail-Client auf Basis von **Electron + React + TypeScript + Tailwind**.

## Funktionen

- **Mehrere Konten** – beliebig viele IMAP/SMTP-Postfächer parallel, jedes mit eigener
  Absenderadresse und -name. Anbieter-Auswahl mit fertigen Serverdaten (Gmail, Outlook,
  GMX, web.de, iCloud, Yahoo, T-Online, mailbox.org, Posteo, Zoho) oder freie IMAP-Eingabe.
- **Browser-Login (OAuth)** für Google und Microsoft – Anmeldung im Standardbrowser,
  ohne Passwort in der App. Einrichtung: [docs/OAUTH-SETUP.md](docs/OAUTH-SETUP.md).
- **Geführter Passwort-Flow** für Anbieter ohne OAuth – die Kachel öffnet direkt die
  richtige Seite zum IMAP-Aktivieren bzw. App-Passwort-Erstellen.
- **Demo-Postfach** – voll funktionsfähiges Offline-Konto zum Ausprobieren, ohne Server.
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

## Paketieren & Installer

Der Installer ist **komplett selbst gebaut** – kein electron-builder, kein NSIS, kein Inno.
Die Setup-EXE ist ein kleines C#-Programm (kompiliert mit dem `csc.exe` aus dem
.NET Framework, das auf jedem Windows vorhanden ist) mit der gepackten App als
eingebetteter Ressource.

```bash
npm run icon       # build/icon.ico + icon.png erzeugen (ohne Bildbibliothek)
npm run pack       # portablen App-Ordner bauen → release/MailWave/
npm run installer  # pack + release/MailWave-Setup-<version>.exe
npm run release    # GitHub-Release anlegen und die Setup-EXE hochladen
```

**Installation** (`MailWave-Setup-<version>.exe`):

- pro Benutzer nach `%LOCALAPPDATA%\Programs\MailWave`, **ohne Administratorrechte**
- Start-Menü- (und optional Desktop-) Verknüpfung, Eintrag unter *Apps & Features*
- `Uninstall.exe` im Installationsordner entfernt alles wieder (Konten/Einstellungen
  unter `%APPDATA%\mailwave` bleiben auf Wunsch erhalten)
- Flags: `/S` still, `/S /update` still ohne App-Neustart, `/D=C:\Pfad` Zielordner

### Automatische Updates

Die App fragt beim Start (und alle 6 h) das neueste GitHub-Release ab. Ist eine
neuere Version da, erscheint eine Meldung mit *Jetzt aktualisieren*. Dann:

1. die neue Setup-EXE wird nach `%TEMP%` geladen
2. der mitgelieferte **Bootstrap-Updater** (`Updater.exe`) wird nach `%TEMP%` kopiert
   und gestartet
3. MailWave beendet sich, der Updater führt `Setup.exe /S /update` aus und startet
   die App neu

Das Repo für die Update-Prüfung steht in `package.json` unter `mailwave.updateRepo`.

Quellcode des Installers: [`installer/`](installer/) · Build-Skripte: [`scripts/`](scripts/)

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
