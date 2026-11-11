// Rendert die zehn Bilder der Anleitung als PNG und baut daraus das bewegte Bild.
// Aufruf: node tools/anleitung-bilder.cjs <Pfad zu playwright> , danach python tools/anleitung-gif.py
// Braucht einen lokalen Server auf docs/ (z. B. python -m http.server 8641 -d docs).
const path = require("path");
const { chromium } = require(process.argv[2] || "playwright");
const ziel = path.join(__dirname, "..", "docs", "anleitung");
const roh = path.join(__dirname, "roh");

(async () => {
  require("fs").mkdirSync(roh, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await p.goto(process.argv[3] || "http://localhost:8641/anleitung/");
  const n = await p.locator(".bild").count();
  for (let i = 0; i < n; i++) {
    const bild = p.locator(".bild").nth(i);
    const nr = String(i + 1).padStart(2, "0");
    await bild.screenshot({ path: path.join(ziel, `schritt-${nr}.png`) });          // mit Markierungen, für README
    await p.evaluate(() => document.body.classList.add("ohne"));
    await bild.screenshot({ path: path.join(roh, `schritt-${nr}-ohne.png`) });       // ohne, für das bewegte Bild
    await p.evaluate(() => document.body.classList.remove("ohne"));
  }
  await b.close();
  console.log(n + " Bilder");
})();
