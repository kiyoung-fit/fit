import { getProfile } from './store.js';
import { resumeRest, adjustRest, stopRest, keepAwake, unlockAudio } from './ui.js';
import * as db from './db.js';

const VIEWS = {
  home: { title: '오늘', load: () => import('./views/home.js') },
  workout: { title: '운동', load: () => import('./views/workout.js') },
  plan: { title: '플랜', load: () => import('./views/plan.js') },
  food: { title: '식단', load: () => import('./views/food.js') },
  health: { title: '건강', load: () => import('./views/health.js') },
  settings: { title: '설정', load: () => import('./views/settings.js') },
};

const root = document.getElementById('view');
let renderId = 0;

export function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

async function route() {
  const id = ++renderId;
  const profile = await getProfile();
  if (!profile) {
    document.body.classList.add('is-onboarding');
    const m = await import('./views/onboarding.js');
    return m.render(root, { go, done: () => { document.body.classList.remove('is-onboarding'); go('#/home'); } });
  }
  document.body.classList.remove('is-onboarding');
  const [name, ...args] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  const v = VIEWS[name] || VIEWS.home;
  document.getElementById('title').textContent = v.title;
  for (const a of document.querySelectorAll('.tabbar a')) {
    if (a.dataset.tab === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const m = await v.load();
  if (id !== renderId) return;
  root.innerHTML = '';
  root.onclick = null; root.oninput = null; root.onchange = null;
  await m.render(root, { go, args, profile, refresh: route });
  window.scrollTo(0, 0);
  // 운동 중이면 화면이 꺼지지 않게
  keepAwake(!!(await db.kv('active')));
}

window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') keepAwake(!!(await db.kv('active')));
});
document.addEventListener('click', unlockAudio, { once: true });

document.getElementById('rest').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rest]');
  if (!b) return;
  if (b.dataset.rest === 'skip') stopRest(); else adjustRest(Number(b.dataset.rest));
});

// 데이터가 브라우저 정리 대상에서 빠지도록 요청 (홈 화면 설치 시 대부분 허용)
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

resumeRest();
route();
