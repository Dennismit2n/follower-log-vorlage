"use strict";

// Höchstens ein Workflow-Lauf je 178 Minuten. Geplante Läufe zählen mit.
const SPERRE_MS = 178 * 60 * 1000;
const WARTEN_MAX_MS = 5 * 60 * 1000;
const API = "https://api.github.com";
const DEMO = new URLSearchParams(location.search).has("demo");
const SPEICHER = DEMO ? "followerlog-demo" : "followerlog";

const $ = (id) => document.getElementById(id);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function lesen() {
  try { return JSON.parse(localStorage.getItem(SPEICHER)) || {}; } catch { return {}; }
}
function schreiben(daten) {
  try { localStorage.setItem(SPEICHER, JSON.stringify(daten)); } catch { /* privater Modus */ }
}
let speicher = lesen();
const merke = (neu) => { speicher = { ...speicher, ...neu }; schreiben(speicher); };

// ---------- GitHub ----------
async function gh(pfad, { methode = "GET", body, roh = false } = {}) {
  if (DEMO) return demoAntwort(pfad, methode);
  const antwort = await fetch(API + pfad, {
    method: methode,
    cache: "no-store",
    headers: {
      Authorization: "Bearer " + speicher.token,
      Accept: roh ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!antwort.ok) {
    const text = antwort.status === 401 ? "Token ungültig oder abgelaufen"
      : antwort.status === 403 ? "Token darf das nicht (Rechte prüfen)"
      : antwort.status === 404 ? "Repo oder Workflow nicht gefunden (oder Token ohne Zugriff)"
      : "GitHub antwortet " + antwort.status;
    throw new Error(text);
  }
  if (antwort.status === 204) return null;
  return roh ? antwort.text() : antwort.json();
}

const repoPfad = () => "/repos/" + speicher.repo;
const wfPfad = () => repoPfad() + "/actions/workflows/" + encodeURIComponent(speicher.workflow);

async function letzterLauf() {
  const j = await gh(wfPfad() + "/runs?per_page=1");
  return j.workflow_runs[0] || null;
}

async function hauptzweig() {
  if (!speicher.zweig) merke({ zweig: (await gh(repoPfad())).default_branch });
  return speicher.zweig;
}

async function datenLaden() {
  const zweig = await hauptzweig();
  const [log, liste] = await Promise.all([
    gh(repoPfad() + "/contents/log.md?ref=" + zweig, { roh: true }),
    gh(repoPfad() + "/contents/followers.txt?ref=" + zweig, { roh: true }),
  ]);
  merke({ log, liste, geladen: Date.now() });
  zeichnen();
}

// ---------- Ablauf beim Öffnen ----------
let beschaeftigt = false;

async function abrufen({ erzwingen = false } = {}) {
  if (beschaeftigt || !speicher.token || !speicher.repo) return;
  beschaeftigt = true;
  $("abrufen").disabled = true;
  try {
    status("Prüfe letzten Lauf …", "laeuft");
    let lauf = await letzterLauf();
    const zuletzt = Math.max(lauf ? Date.parse(lauf.created_at) : 0, speicher.ausgeloest || 0);
    const frei = zuletzt + SPERRE_MS;

    if (lauf && lauf.status !== "completed") {
      await aufLaufWarten(lauf.id);
    } else if (Date.now() < frei) {
      // Sperre aktiv: nur die Dateien neu laden.
      await datenLaden();
      sperreAnzeigen(zuletzt, frei);
      return;
    } else {
      const vorher = lauf ? lauf.id : 0;
      status("Starte Workflow …", "laeuft");
      await gh(wfPfad() + "/dispatches", { methode: "POST", body: { ref: await hauptzweig() } });
      merke({ ausgeloest: Date.now() });
      await aufLaufWarten(null, vorher);
    }
    await datenLaden();
    lauf = await letzterLauf();
    const ergebnis = lauf && lauf.conclusion !== "success" ? " (Lauf: " + lauf.conclusion + ")" : "";
    status("Gerade aktualisiert" + ergebnis + ". Nächster Abruf ab " + uhrzeit(Date.now() + SPERRE_MS) + ".",
      ergebnis ? "fehler" : "");
  } catch (fehler) {
    status(fehler.message, "fehler");
    if (speicher.log) zeichnen();
  } finally {
    beschaeftigt = false;
    knopfZustand();
  }
}

async function aufLaufWarten(id, vorherigeId) {
  const ende = Date.now() + WARTEN_MAX_MS;
  while (Date.now() < ende) {
    await pause(DEMO ? 800 : 5000);
    const lauf = await letzterLauf();
    if (!lauf) continue;
    if (vorherigeId !== undefined && lauf.id === vorherigeId) { status("Workflow ist angemeldet …", "laeuft"); continue; }
    if (id && lauf.id !== id) id = lauf.id;
    if (lauf.status === "completed") return lauf;
    status("Workflow läuft …", "laeuft");
  }
  throw new Error("Der Workflow braucht ungewöhnlich lange. Später noch mal öffnen.");
}

function sperreAnzeigen(zuletzt, frei) {
  status("Letzter Lauf " + vorWann(zuletzt) + ". Nächster Abruf ab " + uhrzeit(frei) + ".");
}

function knopfZustand() {
  const zuletzt = speicher.ausgeloest || 0;
  $("abrufen").disabled = beschaeftigt || !speicher.token;
  $("abrufen").title = Date.now() < zuletzt + SPERRE_MS ? "Gesperrt bis " + uhrzeit(zuletzt + SPERRE_MS) + ", lädt nur die Dateien neu" : "";
}

// ---------- Anzeige ----------
function status(text, art = "") {
  const el = $("status");
  el.textContent = text;
  el.className = "status " + art;
}

const uhrzeit = (ms) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

function vorWann(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return "vor " + min + " min";
  const std = Math.floor(min / 60);
  return "vor " + std + " h " + (min % 60) + " min";
}

function datumText(iso, zeit) {
  const [j, m, t] = iso.split("-").map(Number);
  if (zeit) {
    const d = new Date(Date.UTC(j, m - 1, t, ...zeit.split(":").map(Number)));
    return d.toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return new Date(j, m - 1, t).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

// Liest log.md im neuen Format, alte Zeilen "2026-11-05 ➕ name" gehen auch.
function logLesen(text) {
  const tage = [];
  let tag = null;
  for (const zeile of text.split(/\r?\n/)) {
    const kopf = zeile.match(/^## (\d{4}-\d{2}-\d{2})(?: · (\d{2}:\d{2}) UTC)?/);
    if (kopf) { tag = { datum: kopf[1], zeit: kopf[2], eintraege: [] }; tage.push(tag); continue; }
    const eintrag = zeile.match(/^- \*\*(neu|weg|Startbestand) \((\d+)\):\*\* (.*)$/);
    if (eintrag && tag) {
      const namen = [...eintrag[3].matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
      tag.eintraege.push({ art: eintrag[1] === "Startbestand" ? "start" : eintrag[1], namen });
      continue;
    }
    const alt = zeile.match(/^(\d{4}-\d{2}-\d{2}) (➕|➖) (\S+)/);
    if (alt) {
      let t = tage.find((x) => x.datum === alt[1] && x.alt);
      if (!t) { t = { datum: alt[1], alt: true, eintraege: [] }; tage.unshift(t); }
      const art = alt[2] === "➕" ? "neu" : "weg";
      let e = t.eintraege.find((x) => x.art === art);
      if (!e) { e = { art, namen: [] }; t.eintraege.push(e); }
      e.namen.push(alt[3]);
    }
  }
  return tage;
}

function profil(name) {
  const a = document.createElement("a");
  a.href = "https://github.com/" + encodeURIComponent(name);
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = name;
  return a;
}

function zeichnen() {
  const namen = (speicher.liste || "").split(/\s+/).filter(Boolean);
  $("anzahl").textContent = speicher.liste ? namen.length : "–";

  const verlauf = $("verlauf");
  verlauf.replaceChildren();
  const tage = speicher.log ? logLesen(speicher.log) : [];
  if (!tage.length) {
    const p = document.createElement("p");
    p.className = "leer";
    p.textContent = speicher.token ? "Noch keine Einträge." : "Erst unter ⚙ Repository und Token eintragen.";
    verlauf.append(p);
  }
  for (const tag of tage) {
    const box = document.createElement("div");
    box.className = "tag";
    const h = document.createElement("h3");
    h.textContent = datumText(tag.datum, tag.zeit);
    box.append(h);
    for (const e of tag.eintraege) {
      const zeile = document.createElement("div");
      zeile.className = "eintrag";
      const marke = document.createElement("span");
      marke.className = "marke " + e.art;
      marke.textContent = e.art === "start" ? "Start" : e.art;
      const wer = document.createElement("div");
      wer.className = "wer";
      if (e.art === "start") {
        const d = document.createElement("details");
        const s = document.createElement("summary");
        s.textContent = e.namen.length + " Follower zum Start";
        const innen = document.createElement("div");
        innen.className = "wer";
        innen.append(...e.namen.map(profil));
        d.append(s, innen);
        wer.append(d);
      } else {
        wer.append(...e.namen.map(profil));
      }
      zeile.append(marke, wer);
      box.append(zeile);
    }
    verlauf.append(box);
  }
  listeZeichnen(namen);
}

function listeZeichnen(namen = (speicher.liste || "").split(/\s+/).filter(Boolean)) {
  const filter = $("suche").value.trim().toLowerCase();
  const ul = $("namen");
  ul.replaceChildren(...namen
    .filter((n) => n.toLowerCase().includes(filter))
    .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }))
    .map((n) => { const li = document.createElement("li"); li.append(profil(n)); return li; }));
}

// ---------- Bedienung ----------
document.querySelectorAll(".reiter button").forEach((knopf) => {
  knopf.addEventListener("click", () => {
    document.querySelectorAll(".reiter button").forEach((k) => k.setAttribute("aria-selected", k === knopf));
    $("verlauf").hidden = knopf.dataset.reiter !== "verlauf";
    $("liste").hidden = knopf.dataset.reiter !== "liste";
  });
});
$("suche").addEventListener("input", () => listeZeichnen());
$("abrufen").addEventListener("click", () => abrufen());

$("einstellungenKnopf").addEventListener("click", () => {
  $("repo").value = speicher.repo || "";
  $("workflow").value = speicher.workflow || "followers.yml";
  $("token").value = speicher.token || "";
  $("einstellungen").showModal();
});
$("formular").addEventListener("submit", () => {
  const repo = $("repo").value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
  merke({ repo, workflow: $("workflow").value.trim(), token: $("token").value.trim(), zweig: null });
  knopfZustand();
  abrufen();
});
$("vergessen").addEventListener("click", () => {
  speicher = {};
  try { localStorage.removeItem(SPEICHER); } catch { /* egal */ }
  $("einstellungen").close();
  zeichnen();
  status("Alles auf diesem Gerät gelöscht.");
  knopfZustand();
});

// Installieren-Knopf
let installEreignis = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEreignis = e;
  $("installieren").hidden = false;
});
$("installieren").addEventListener("click", async () => {
  if (!installEreignis) return;
  installEreignis.prompt();
  await installEreignis.userChoice;
  installEreignis = null;
  $("installieren").hidden = true;
});
addEventListener("appinstalled", () => { $("installieren").hidden = true; });

// Beim Zurückholen aus dem Hintergrund ebenfalls prüfen (die Sperre gilt trotzdem).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && speicher.geladen && Date.now() - speicher.geladen > 60000) abrufen();
});

if ("serviceWorker" in navigator && !DEMO) navigator.serviceWorker.register("sw.js");

// ---------- Demo (?demo), ganz ohne Token ----------
let demoLauf = { id: 1, status: "completed", conclusion: "success", created_at: new Date(Date.now() - 4 * 3600e3).toISOString() };
function demoAntwort(pfad, methode) {
  if (methode === "POST") {
    demoLauf = { id: 2, status: "queued", created_at: new Date().toISOString() };
    setTimeout(() => { demoLauf.status = "in_progress"; }, 1000);
    setTimeout(() => { demoLauf.status = "completed"; demoLauf.conclusion = "success"; }, 2500);
    return Promise.resolve(null);
  }
  if (pfad.includes("/runs")) return Promise.resolve({ workflow_runs: [demoLauf] });
  if (pfad.endsWith("log.md?ref=main")) return Promise.resolve(DEMO_LOG);
  if (pfad.includes("followers.txt")) return Promise.resolve("ada\nbrian-k\ngrace-h\nlinus\nmargaret\nnova-dev\nrust-fan\nsam\nzoe\n");
  return Promise.resolve({ default_branch: "main" });
}
const DEMO_LOG = "# Logbuch\n\n## 2026-11-11 · 09:14 UTC\n\n- **neu (2):** [nova-dev](https://github.com/nova-dev), [zoe](https://github.com/zoe)\n- **weg (1):** [old-account](https://github.com/old-account)\n\n## 2026-11-09 · 09:21 UTC\n\n- **neu (1):** [rust-fan](https://github.com/rust-fan)\n\n## 2026-11-05\n\n- **Startbestand (7):** [ada](https://github.com/ada), [brian-k](https://github.com/brian-k), [grace-h](https://github.com/grace-h), [linus](https://github.com/linus), [margaret](https://github.com/margaret), [old-account](https://github.com/old-account), [sam](https://github.com/sam)\n";
if (DEMO && !speicher.token) merke({ token: "demo", repo: "demo/follower-log", workflow: "followers.yml" });

// ---------- Start ----------
zeichnen();
knopfZustand();
if (speicher.token && speicher.repo) abrufen();
else { status("Noch nicht eingerichtet."); $("einstellungen").showModal(); }
