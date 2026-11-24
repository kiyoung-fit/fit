// 오프라인 동작: 앱 파일은 미리 저장, 새 버전이 있으면 다음 실행 때 반영
const VERSION = 'v1';
const CACHE = `my-health-${VERSION}`;
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css', 'css/tokens.css', 'css/base.css',
  'fonts/geist-mono-400.woff2', 'fonts/geist-mono-500.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/db.js', 'js/calc.js', 'js/ui.js', 'js/store.js', 'js/planner.js', 'js/foods.js', 'js/chart.js',
  'js/data/exercises.js', 'js/data/foods.json',
  'js/views/home.js', 'js/views/workout.js', 'js/views/plan.js', 'js/views/food.js', 'js/views/health.js', 'js/views/settings.js', 'js/views/onboarding.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('my-health-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 캐시 먼저 보여주고, 온라인이면 뒤에서 새 파일로 갱신
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || cache.match('index.html');
  }));
});
