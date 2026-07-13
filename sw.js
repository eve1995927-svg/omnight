// 案場通 Service Worker
// 策略：優先用網路上最新的版本（network-first），只有完全離線時才退回快取，
// 這樣不會有「明明部署了新版，使用者卻卡在舊版」的常見 PWA 陷阱。
const CACHE_NAME = 'ancase-shell-v1';
const APP_SHELL = [
  './index.html',
  './css/style.css',
  './js/core.js',
  './js/projects.js',
  './js/quote.js',
  './js/vendor-punch.js',
  './js/hr-marketing.js',
  './js/billing-contracts.js',
  './js/misc.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 只快取自己網站內的檔案（不快取 Firebase / AI API 這些即時資料請求）
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
