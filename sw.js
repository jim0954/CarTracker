// --- Service Worker：讓網頁可加到主畫面並在離線時開啟 ---
// 本站檔案：網路優先（確保拿到最新版），離線時改用快取
// CDN 檔案（Tailwind、FontAwesome、Chart.js）：先用快取，背景更新
// Google 登入與 Apps Script 請求不經過快取
const CACHE = 'cartracker-v4';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './assets/icons/icon-192.png',
  './js/tailwind.config.js',
  './js/main.js',
  './js/config.js',
  './js/store.js',
  './js/api.js',
  './js/auth.js',
  './js/session.js',
  './js/utils.js',
  './js/sample-data.js',
  './js/render/app.js',
  './js/render/maintenance.js',
  './js/render/records.js',
  './js/render/fuel.js',
  './js/render/stats.js',
  './js/actions/tabs.js',
  './js/actions/vehicle.js',
  './js/actions/record.js',
  './js/actions/item.js',
  './js/actions/backup.js',
  './js/iknow99.js',
  './js/parts.js'
];

const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then(response => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || update;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
