// 오프라인 동작: 앱 파일은 미리 저장, 새 버전이 있으면 다음 실행 때 반영
const VERSION = 'v7';
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
// 운동 사진 (오프라인에서도 보이게 미리 저장)
const IMAGES = ["img/ex/ab_crunch_m-0.webp", "img/ex/ab_crunch_m-1.webp", "img/ex/abductor-0.webp", "img/ex/abductor-1.webp", "img/ex/adductor-0.webp", "img/ex/adductor-1.webp", "img/ex/assist_pullup-0.webp", "img/ex/assist_pullup-1.webp", "img/ex/bb_curl-0.webp", "img/ex/bb_curl-1.webp", "img/ex/bb_row-0.webp", "img/ex/bb_row-1.webp", "img/ex/bench-0.webp", "img/ex/bench-1.webp", "img/ex/cable_crunch-0.webp", "img/ex/cable_crunch-1.webp", "img/ex/cable_curl-0.webp", "img/ex/cable_curl-1.webp", "img/ex/cable_fly-0.webp", "img/ex/cable_fly-1.webp", "img/ex/cable_lat-0.webp", "img/ex/cable_lat-1.webp", "img/ex/calf_raise-0.webp", "img/ex/calf_raise-1.webp", "img/ex/chest_press-0.webp", "img/ex/chest_press-1.webp", "img/ex/db_bench-0.webp", "img/ex/db_bench-1.webp", "img/ex/db_curl-0.webp", "img/ex/db_curl-1.webp", "img/ex/db_ohp-0.webp", "img/ex/db_ohp-1.webp", "img/ex/db_rdl-0.webp", "img/ex/db_rdl-1.webp", "img/ex/db_row-0.webp", "img/ex/db_row-1.webp", "img/ex/deadlift-0.webp", "img/ex/deadlift-1.webp", "img/ex/dip-0.webp", "img/ex/dip-1.webp", "img/ex/face_pull-0.webp", "img/ex/face_pull-1.webp", "img/ex/goblet-0.webp", "img/ex/goblet-1.webp", "img/ex/hack_squat-0.webp", "img/ex/hack_squat-1.webp", "img/ex/hammer-0.webp", "img/ex/hammer-1.webp", "img/ex/hip_thrust-0.webp", "img/ex/hip_thrust-1.webp", "img/ex/hip_thrust_m-0.webp", "img/ex/hip_thrust_m-1.webp", "img/ex/incline_db-0.webp", "img/ex/incline_db-1.webp", "img/ex/incline_press_m-0.webp", "img/ex/incline_press_m-1.webp", "img/ex/lat_pd-0.webp", "img/ex/lat_pd-1.webp", "img/ex/lat_raise-0.webp", "img/ex/lat_raise-1.webp", "img/ex/leg_curl-0.webp", "img/ex/leg_curl-1.webp", "img/ex/leg_ext-0.webp", "img/ex/leg_ext-1.webp", "img/ex/leg_press-0.webp", "img/ex/leg_press-1.webp", "img/ex/leg_raise-0.webp", "img/ex/leg_raise-1.webp", "img/ex/lunge-0.webp", "img/ex/lunge-1.webp", "img/ex/oh_ext-0.webp", "img/ex/oh_ext-1.webp", "img/ex/ohp-0.webp", "img/ex/ohp-1.webp", "img/ex/pec_fly-0.webp", "img/ex/pec_fly-1.webp", "img/ex/plank-0.webp", "img/ex/plank-1.webp", "img/ex/pullup-0.webp", "img/ex/pullup-1.webp", "img/ex/pushdown-0.webp", "img/ex/pushdown-1.webp", "img/ex/pushup-0.webp", "img/ex/pushup-1.webp", "img/ex/rdl-0.webp", "img/ex/rdl-1.webp", "img/ex/rear_fly-0.webp", "img/ex/rear_fly-1.webp", "img/ex/row_m-0.webp", "img/ex/row_m-1.webp", "img/ex/seated_row-0.webp", "img/ex/seated_row-1.webp", "img/ex/shoulder_press_m-0.webp", "img/ex/shoulder_press_m-1.webp", "img/ex/skull-0.webp", "img/ex/skull-1.webp", "img/ex/split_squat-0.webp", "img/ex/split_squat-1.webp", "img/ex/squat-0.webp", "img/ex/squat-1.webp", "img/ex/straight_pd-0.webp", "img/ex/straight_pd-1.webp", "img/ex/tbar_row-0.webp", "img/ex/tbar_row-1.webp"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...FILES, ...IMAGES])).then(() => self.skipWaiting()));
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
