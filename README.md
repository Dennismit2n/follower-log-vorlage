# follower-log-vorlage

Wer folgt dir auf GitHub, und wer ist wieder gegangen? Diese Vorlage legt dir ein privates Logbuch an und bringt eine kleine App fürs Handy mit, die beim Öffnen nachsieht.

<img src="docs/bildschirmfoto.png" alt="Die App auf dem Handy: oben die Zahl der Follower, darunter der Verlauf mit neu und weg je Tag" width="320">

**App:** https://dennismit2n.github.io/follower-log-vorlage/ (zum Ausprobieren ohne Konto: [Demo](https://dennismit2n.github.io/follower-log-vorlage/?demo))

## Was passiert

- Ein GitHub-Actions-Workflow holt einmal am Tag (09:09 UTC) die Liste deiner Follower und vergleicht sie mit dem letzten Stand.
- `followers.txt` enthält die aktuelle Liste, `log.md` das Logbuch mit den neuesten Einträgen oben: **neu** folgt seitdem, **weg** folgt nicht mehr. Jeder Name verlinkt auf das Profil.
- Die App startet den Workflow beim Öffnen, aber höchstens einmal alle 178 Minuten. Geplante Läufe zählen mit. Ist die Sperre aktiv, lädt sie nur das Logbuch neu und zeigt, ab wann der nächste Abruf geht.
- Der Bot committet als `follower-bot`, damit nichts in deinem Beitragsgraphen landet.

## Einrichten (etwa fünf Minuten)

1. **Repo anlegen:** oben auf *Use this template*, dann *Create a new repository*. Als Sichtbarkeit **Private** wählen, sonst kann jeder deine Follower-Liste lesen.
2. **Erster Lauf:** in deinem neuen Repo Reiter *Actions*, Workflow *Follower-Tracker*, *Run workflow*. Nach etwa einer halben Minute liegen `followers.txt` und `log.md` im Repo. Der erste Eintrag heißt *Startbestand* und listet alle bisherigen Follower.
3. **Token für die App:** auf GitHub *Settings*, *Developer settings*, *Personal access tokens*, *Fine-grained tokens*, *Generate new token*.
   - *Repository access:* **Only select repositories**, dann nur dein Logbuch-Repo.
   - *Permissions:* **Actions: Read and write** und **Contents: Read-only**. Mehr braucht die App nicht.
   - Ablaufdatum nach Geschmack. Ist es vorbei, meldet die App „Token ungültig oder abgelaufen“.
4. **App öffnen:** die App-Adresse oben auf dem Handy öffnen, unter ⚙ dein Repo (`konto/name`) und den Token eintragen, speichern.
5. **Installieren:** in Chrome oder Edge auf Android den Knopf *Installieren* oben in der App antippen. Auf dem iPhone in Safari *Teilen*, dann *Zum Home-Bildschirm*.

Der Token bleibt nur auf deinem Gerät gespeichert und geht ausschließlich an `api.github.com`. Die App hat keinen eigenen Server, sammelt nichts und zählt keine Besuche. Unter ⚙ *Alles vergessen* löscht Token und Daten vom Gerät.

## Uhrzeit ändern

In `.github/workflows/followers.yml` steht `- cron: "9 9 * * *"`. Die erste Zahl ist die Minute, die zweite die Stunde, beides in UTC. Für 18:30 UTC also `"30 18 * * *"`. MEZ ist UTC plus eine Stunde, MESZ plus zwei. GitHub startet geplante Läufe oft etwas später als angegeben, manchmal eine Stunde und mehr.

Die Sperre der App steht in `docs/app.js` ganz oben: `const SPERRE_MS = 178 * 60 * 1000;`.

## App selbst hosten

Lieber eine eigene Adresse? Die App liegt komplett in `docs/` und braucht keinen Bauschritt. Jeder statische Webspace mit HTTPS reicht. GitHub Pages geht für private Repos nur mit einem bezahlten Konto; mit einem öffentlichen Zweit-Repo nur für den Ordner `docs/` klappt es kostenlos.

## Dateien

| Datei | Aufgabe |
|---|---|
| `.github/workflows/followers.yml` | der tägliche Lauf, auch von Hand und aus der App startbar |
| `.github/logbuch.py` | vergleicht die Listen und schreibt `log.md` |
| `docs/` | die App: `index.html`, `app.js`, `style.css`, Service Worker, Manifest, Icons |

Die Vorlage selbst führt den Workflow nicht aus, erst deine Kopie.

Lizenz: MIT. Gebaut von [Dennis_mit_2n](https://dennismit2n.github.io/).
