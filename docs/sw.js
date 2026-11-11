// Hält nur die App-Hülle offline bereit. Anfragen an api.github.com gehen immer direkt ins Netz.
const VERSION = "followerlog-v5";
const HUELLE = ["./", "index.html", "style.css?v=4", "app.js?v=1", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(HUELLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((k) => Promise.all(k.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== "GET") return;
  // Netz zuerst, damit Updates sofort ankommen; ohne Netz aus dem Speicher.
  e.respondWith(fetch(e.request)
    .then((r) => { const kopie = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, kopie)); return r; })
    .catch(() => caches.match(e.request)));
});
