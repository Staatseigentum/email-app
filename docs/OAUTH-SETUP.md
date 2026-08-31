# Browser-Login (OAuth) einrichten

Google und Microsoft erlauben Drittanbieter-Apps den Zugriff auf IMAP/SMTP nur über
**OAuth**. Dafür braucht MailWave eine **eigene Client-ID**, die du einmalig anlegst
(kostenlos, ~5 Minuten). Danach: Anbieter-Kachel → „Mit Google/Microsoft anmelden" →
Browser → fertig, ohne Passwort.

Die Client-ID (bei Google zusätzlich das Client-Secret) trägst du im Konto-Dialog ein.
Sie wird lokal verschlüsselt in `<userData>/data/oauth.json` gespeichert.

---

## Google / Gmail

1. **console.cloud.google.com** öffnen → Projekt anlegen (z. B. „MailWave").
2. **APIs & Dienste → OAuth-Zustimmungsbildschirm** (neue Oberfläche: **Google Auth
   Platform**):
   - Nutzertyp **Extern**, App-Name + eigene E-Mail eintragen.
3. **APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID**:
   - Anwendungstyp: **Desktop-App**.
   - Nach dem Erstellen **„JSON herunterladen"** – diese Datei in MailWave wählen
     (oder Client-ID + Client-Schlüssel kopieren).
4. Eine „Gmail API" muss **nicht** aktiviert werden – der Scope ist `https://mail.google.com/`.
5. **Zugriff freischalten** – sonst „Fehler 403: access_denied" beim Login:
   - **Empfohlen:** OAuth-Zustimmungsbildschirm / „Zielgruppe" → **„App veröffentlichen"
     / „In Produktion"**. Dann keine Testnutzer-Liste nötig und die Anmeldung läuft
     **nicht nach 7 Tagen ab**. Die Google-Verifizierung ist nur für die Weitergabe an
     Dritte nötig – für den Eigengebrauch ignorieren.
   - **Alternative:** im Test-Modus bleiben und unter **„Testnutzer"** die eigene
     Gmail-Adresse hinzufügen. Nachteil: Tokens laufen alle 7 Tage ab.
6. Beim ersten Login erscheint „Google hat diese App nicht überprüft" →
   **Erweitert → Weiter zu … (unsicher)**. Das ist bei der eigenen App normal.
7. In MailWave: Gmail-Kachel → credentials.json wählen → „Mit Google anmelden".

Redirect-URI muss nicht eingetragen werden (Loopback `http://127.0.0.1:<Port>` ist bei
Desktop-Apps automatisch erlaubt).

---

## Microsoft / Outlook / Office 365

> **„Anwendungen außerhalb eines Verzeichnisses zu erstellen, ist veraltet"** /
> **AADSTS16000 … does not exist in tenant**: Dein privates Microsoft-Konto (Outlook.com,
> Hotmail, Live) hat noch **kein Verzeichnis (Tenant)**. Einmalig anlegen:
> **entra.microsoft.com → oben Einstellungen-Zahnrad → „Verzeichnisse + Abonnements"**
> bzw. **Identität → Übersicht → Mandanten verwalten → + Erstellen → „Microsoft Entra ID"**.
> Organisationsname + Anfangsdomäne + Land eintragen → *Überprüfen und erstellen*.
> Danach oben rechts in **dieses neue Verzeichnis wechseln** und erst dann die
> App-Registrierung anlegen. (Alternativ: kostenloses Azure-Konto unter
> `azure.microsoft.com/free` – legt automatisch ein „Standardverzeichnis" an.)

1. **entra.microsoft.com** (oder portal.azure.com) → **App-Registrierungen → Neue Registrierung**.
   - Name: „MailWave".
   - Unterstützte Kontotypen: **Konten in einem beliebigen Organisationsverzeichnis und
     persönliche Microsoft-Konten**.
   - Plattform **Mobile- und Desktopanwendungen**, Redirect-URI: `http://localhost`.
2. Nach dem Anlegen die **Anwendungs-(Client-)ID** kopieren. Kein Secret nötig.
3. **Authentifizierung** → sicherstellen, dass unter „Mobile- und Desktopanwendungen"
   `http://localhost` steht und „Öffentliche Clientflows zulassen" = **Ja**.
4. **API-Berechtigungen** → Microsoft Graph ist nicht nötig; die Scopes
   `https://outlook.office.com/IMAP.AccessAsUser.All` und `.../SMTP.Send` werden beim
   Login angefragt und vom Nutzer bestätigt.
5. In MailWave: Outlook-Kachel → Client-ID einfügen → „Client-ID speichern" → „Mit Microsoft anmelden".

> Manche Firmen-Tenants sperren IMAP/OAuth für Drittanbieter – dann hilft nur der
> Admin oder ein App-Passwort.

---

## Anbieter ohne OAuth

GMX, web.de, iCloud, Yahoo, T-Online, Posteo, mailbox.org, Zoho: **kein Browser-Login
möglich.** In MailWave öffnet die jeweilige Kachel direkt die richtige Hilfeseite
(IMAP aktivieren bzw. App-Passwort erstellen) und zeigt die Schritte. Danach nur
E-Mail-Adresse + (App-)Passwort eintragen.
