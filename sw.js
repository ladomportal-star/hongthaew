/* Service worker: lets the app be installed, open instantly and work offline.

   - The app opens straight from the saved copy (no waiting on the network), so a
     slow or missing connection never leaves a white screen.
   - Script/style files carry a version code (?v=…) from build.py, so a saved copy is
     always the right one for the page that asks for it.
   - Updates: build.py changes CACHE and SHELL below on every build, so the browser
     sees a new sw.js, downloads the new files in the background and then hands over;
     the app reloads itself into the new version when it is safe (see app.js).
   - Google Sheet requests (another origin) are never touched. */
const CACHE = "hongthaew-6ef988724d";
const FONTS = "hongthaew-fonts";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "favicon-32.png",
  "styles.css?v=3f7fe37c64",
  "logic.js?v=236d67d7d0",
  "config.js?v=4150850b14",
  "store.js?v=f4558abc42",
  "app.js?v=2789e492bb"
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  // cache: "reload" so the new version's files are fetched fresh, not from HTTP cache.
  e.waitUntil(
    caches
      .open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (name, req, res) => {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(name).then(c => c.put(req, copy));
  }
  return res;
};

// Saved copy first; the network only when it is not saved yet.
const cacheFirst = (req, name) =>
  caches.match(req).then(hit => hit || fetch(req).then(res => put(name, req, res)));

// Network, but give up after `ms` and use the saved copy if there is one.
function networkFirst(req, ms) {
  const net = fetch(req, { cache: "no-cache" }).then(res => put(CACHE, req, res));
  const saved = () => caches.match(req, { ignoreSearch: true });
  return new Promise(resolve => {
    let done = false;
    const finish = r => {
      if (!done && r) {
        done = true;
        resolve(r);
      }
    };
    const timer = setTimeout(() => saved().then(finish), ms);
    net
      .then(r => {
        clearTimeout(timer);
        finish(r);
      })
      .catch(() => {
        clearTimeout(timer);
        saved().then(r => finish(r || Response.error()));
      });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(req, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Opening the app: the saved page at once (it matches the saved scripts). New
  // versions arrive through a new sw.js, not through this request.
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("index.html").then(hit => hit || networkFirst(req, 4000))
    );
    return;
  }

  // Versioned scripts/styles, icons and the manifest never change under the same URL.
  if (url.searchParams.has("v") || /\.(png|webmanifest)$/.test(url.pathname)) {
    e.respondWith(cacheFirst(req, CACHE));
    return;
  }

  // Anything else (e.g. GoogleAppsScript.gs for the copy button).
  e.respondWith(networkFirst(req, 4000));
});
