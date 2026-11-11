"""Vergleicht neu.txt mit followers.txt und schreibt das Logbuch fort.

Neueste Einträge stehen oben. Jeder Lauf mit Änderungen bekommt einen Block:

    ## 2026-11-11 · 09:09 UTC

    - **neu (1):** [name](https://github.com/name)
    - **weg (1):** [name](https://github.com/name)
"""
import datetime
import pathlib

KOPF = (
    "# Logbuch\n\n"
    "Neueste Einträge oben. **neu** = folgt seitdem, **weg** = folgt nicht mehr.\n"
)

alt_datei = pathlib.Path("followers.txt")
neu_datei = pathlib.Path("neu.txt")
log_datei = pathlib.Path("log.md")

alt = set(alt_datei.read_text(encoding="utf-8").split()) if alt_datei.exists() else set()
neu = set(neu_datei.read_text(encoding="utf-8").split())


def namen(liste):
    return ", ".join(f"[{n}](https://github.com/{n})" for n in sorted(liste, key=str.lower))


zeilen = []
if not alt:
    zeilen.append(f"- **Startbestand ({len(neu)}):** {namen(neu)}")
else:
    if neu - alt:
        zeilen.append(f"- **neu ({len(neu - alt)}):** {namen(neu - alt)}")
    if alt - neu:
        zeilen.append(f"- **weg ({len(alt - neu)}):** {namen(alt - neu)}")

alt_datei.write_text("".join(n + "\n" for n in sorted(neu)), encoding="utf-8")
neu_datei.unlink()

if zeilen:
    jetzt = datetime.datetime.now(datetime.timezone.utc)
    block = f"## {jetzt:%Y-%m-%d · %H:%M} UTC\n\n" + "\n".join(zeilen) + "\n"
    log = log_datei.read_text(encoding="utf-8") if log_datei.exists() else KOPF
    kopf, trenner, rest = log.partition("\n## ")
    log = kopf.rstrip("\n") + "\n\n" + block + (("\n## " + rest) if trenner else "")
    log_datei.write_text(log, encoding="utf-8")
