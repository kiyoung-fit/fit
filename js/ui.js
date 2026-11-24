// 화면 공통 도구: 이스케이프, 아이콘, 바텀시트, 알림 줄, 휴식 타이머, 화면 꺼짐 방지
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = {
  home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
  lift: '<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>',
  plan: '<path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/>',
  food: '<path d="M4 11h16a8 8 0 0 1-16 0zM9 7c0-1.5 1-2 1-3M14 7c0-1.5 1-2 1-3"/>',
  body: '<path d="M4 18 9 12l4 3 7-9M15 6h5v5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  star: '<path d="m12 4 2.4 5 5.6.7-4.1 3.8 1 5.5L12 16.3 7.1 19l1-5.5L4 9.7 9.6 9z"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8v.5"/>',
  copy: '<path d="M8 8h11v11H8zM5 16V5h11"/>',
  timer: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2 2M10 3h4"/>',
};
export const icon = (name, label = '') =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${P[name]}</svg>`;

// 숫자 +/− 조절기. 가운데 숫자를 누르면 키보드로 직접 입력
export function stepper({ name, value, step = 1, min = 0, unit = '', label, decimal = false }) {
  return `<div class="stepper" data-step="${step}" data-min="${min}">
    <button type="button" class="step-btn" data-step-dir="-1" aria-label="${esc(label)} ${step} 줄이기">${icon('minus')}</button>
    <label class="step-field"><span class="visually-hidden">${esc(label)}</span>
      <input class="measure" name="${name}" type="text" inputmode="${decimal ? 'decimal' : 'numeric'}" autocomplete="off" value="${value ?? ''}" placeholder="0">
      ${unit ? `<span class="unit">${unit}</span>` : ''}</label>
    <button type="button" class="step-btn" data-step-dir="1" aria-label="${esc(label)} ${step} 늘리기">${icon('plus')}</button>
  </div>`;
}

// 문서 전체에서 조절기 버튼 처리
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-step-dir]');
  if (!b) return;
  const box = b.closest('.stepper');
  const input = box.querySelector('input');
  const step = parseFloat(box.dataset.step);
  const min = parseFloat(box.dataset.min);
  const cur = parseFloat(input.value) || 0;
  const next = Math.max(min, Math.round((cur + step * Number(b.dataset.stepDir)) * 100) / 100);
  input.value = next;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

export const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

// 바텀시트 (dialog). actions: { name: (el, form, close) => void }
export function sheet({ title, body, actions = {}, onInput, wide = false }) {
  const d = document.createElement('dialog');
  d.className = 'sheet' + (wide ? ' sheet--tall' : '');
  d.setAttribute('aria-label', title);
  d.innerHTML = `<form method="dialog" class="sheet-inner" novalidate>
    <header class="sheet-head"><h2>${esc(title)}</h2>
      <button type="button" class="icon-btn" data-act="close" aria-label="닫기">${icon('x')}</button></header>
    <div class="sheet-body">${body}</div></form>`;
  document.body.append(d);
  const close = () => { d.close(); d.remove(); };
  const form = d.querySelector('form');
  form.addEventListener('submit', (e) => e.preventDefault());
  d.addEventListener('click', (e) => {
    if (e.target === d) return close();
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'close') return close();
    actions[el.dataset.act]?.(el, form, close);
  });
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  if (onInput) form.addEventListener('input', (e) => onInput(e.target, form));
  d.showModal();
  return { el: d, form, close, body: d.querySelector('.sheet-body') };
}

export function confirmSheet(title, text, okLabel, danger = false) {
  return new Promise((resolve) => {
    const s = sheet({
      title,
      body: `<p class="sheet-text">${esc(text)}</p><div class="row-actions">
        <button type="button" class="btn" data-act="no">취소</button>
        <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-act="yes">${esc(okLabel)}</button></div>`,
      actions: { yes: (_, __, c) => { c(); resolve(true); }, no: (_, __, c) => { c(); resolve(false); } },
    });
    s.el.addEventListener('close', () => resolve(false));
  });
}

// 짧은 상태 알림 (저장됨 같은 확인 메시지는 쓰지 않고, 사용자가 알아야 할 것만)
export function notice(text) {
  const n = document.getElementById('notice');
  n.textContent = text;
  n.hidden = false;
  clearTimeout(notice.t);
  notice.t = setTimeout(() => { n.hidden = true; }, 3200);
}

// ---------- 휴식 타이머: 끝나는 시각을 저장해 두고 남은 시간을 계산 ----------
let audio;
export function unlockAudio() {
  if (audio) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* 소리 없이 진행 */ }
}
function beep() {
  if (!audio) return;
  const t0 = audio.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
    g.gain.setValueAtTime(0.0001, t0 + i * 0.35);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.35 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.35 + 0.25);
    o.start(t0 + i * 0.35); o.stop(t0 + i * 0.35 + 0.3);
  }
}

const rest = { end: 0, total: 0, tick: null };
export function startRest(seconds) {
  unlockAudio();
  rest.total = seconds;
  rest.end = Date.now() + seconds * 1000;
  localSave();
  runRest();
}
function localSave() { try { localStorage.setItem('restEnd', JSON.stringify({ end: rest.end, total: rest.total })); } catch { /* 저장 못 해도 타이머는 동작 */ } }
export function resumeRest() {
  try {
    const s = JSON.parse(localStorage.getItem('restEnd') || 'null');
    if (s && s.end > Date.now()) { Object.assign(rest, s); runRest(); }
  } catch { /* 무시 */ }
}
export function adjustRest(sec) { if (!rest.end) return; rest.end += sec * 1000; rest.total += sec; localSave(); paintRest(); }
export function stopRest() {
  rest.end = 0; clearInterval(rest.tick); localSave();
  const bar = document.getElementById('rest'); bar.hidden = true; document.body.classList.remove('has-rest');
}
function runRest() {
  clearInterval(rest.tick);
  const bar = document.getElementById('rest');
  bar.hidden = false; document.body.classList.add('has-rest');
  paintRest();
  rest.tick = setInterval(paintRest, 250);
}
function paintRest() {
  const left = Math.max(0, Math.ceil((rest.end - Date.now()) / 1000));
  const bar = document.getElementById('rest');
  bar.querySelector('.rest-time').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  bar.querySelector('.rest-fill').style.transform = `scaleX(${rest.total ? 1 - left / rest.total : 1})`;
  if (left <= 0) {
    clearInterval(rest.tick);
    beep();
    bar.classList.add('rest--done');
    setTimeout(() => { bar.classList.remove('rest--done'); stopRest(); }, 2500);
  }
}

// ---------- 화면 꺼짐 방지 (운동 중) ----------
let lock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !lock && document.visibilityState === 'visible') {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}

export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
