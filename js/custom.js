// 내 운동: 사용자가 직접 추가한 운동(기구). 부위는 필수, 사진은 선택
import * as db from './db.js';
import { esc, sheet, notice } from './ui.js';
import { MUSCLES, EQUIP, PATTERNS, PHOTOS, registerCustom, byId } from './data/exercises.js';
import { getPlan, savePlan, getProfile, saveProfile } from './store.js';

export async function loadCustom() {
  const list = await db.kv('customExercises', []);
  for (const c of list) {
    if (c.photo && !PHOTOS[c.id]) PHOTOS[c.id] = await db.kv('exPhoto:' + c.id);
  }
  registerCustom(list);
  return list;
}

async function saveList(list) {
  await db.setKv('customExercises', list);
  registerCustom(list);
}

// 사진을 다른 운동 사진과 같은 파란 2색 톤, 480×320으로 바꿈 (tools/make_ex_images.py와 같은 변환)
async function toDuotone(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = 480, h = 320;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const sc = Math.max(w / img.width, h / img.height);
    x.drawImage(img, (w - img.width * sc) / 2, (h - img.height * sc) / 2, img.width * sc, img.height * sc);
    const d = x.getImageData(0, 0, w, h), p = d.data;
    const dark = [18, 42, 84], light = [242, 247, 253];
    for (let i = 0; i < p.length; i += 4) {
      let l = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
      l = Math.min(1, Math.max(0, (l - 0.06) * 1.25));
      for (let k = 0; k < 3; k++) p[i + k] = dark[k] + (light[k] - dark[k]) * l;
    }
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 추가·수정 시트. onSaved(새 운동 id)
export async function customForm({ onSaved, edit = null, muscle = null } = {}) {
  const list = await db.kv('customExercises', []);
  const d = edit ? { ...edit } : { name: '', muscle, pattern: null, equip: 'machine', compound: null, memo: '' };
  let photo = edit?.photo ? PHOTOS[edit.id] : null;
  if (d.muscle && !d.pattern) d.pattern = PATTERNS[d.muscle][0][0];

  const chips = (name, items, cur) => items.map(([v, l]) => `<button type="button" class="chip" data-act="${name}" data-v="${v}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('');
  const body = () => `
    <label class="field"><span class="field-label">운동 이름</span>
      <input type="text" name="name" maxlength="30" autocomplete="off" value="${esc(d.name)}" placeholder="예: 해머 스트렝스 로우"></label>
    <fieldset class="group"><legend>어느 부위 운동인가요? (꼭 골라주세요)</legend>
      <div class="chips">${chips('muscle', Object.entries(MUSCLES), d.muscle)}</div></fieldset>
    ${d.muscle ? `<fieldset class="group"><legend>동작 종류</legend><div class="chips">${chips('pattern', PATTERNS[d.muscle], d.pattern)}</div></fieldset>` : ''}
    <fieldset class="group"><legend>기구</legend><div class="chips">${chips('equip', Object.entries(EQUIP), d.equip)}</div></fieldset>
    <label class="field"><span class="field-label">자세 메모 (선택)</span>
      <input type="text" name="memo" maxlength="60" autocomplete="off" value="${esc(d.memo || '')}" placeholder="예: 의자 높이 4번, 가슴 패드에 붙이기"></label>
    <div class="field"><span class="field-label">기구 사진 (선택)</span>
      <div class="photo-pick">${photo ? `<span class="ex-thumb ex-thumb--l"><img src="${photo}" alt="" width="144" height="96"></span>` : ''}
        <label class="btn btn--small">${photo ? '다시 찍기' : '사진 찍기·고르기'}<input type="file" name="photo" accept="image/*" capture="environment" class="visually-hidden"></label>
        ${photo ? '<button type="button" class="btn btn--small btn--quiet" data-act="nophoto">사진 빼기</button>' : ''}</div>
      <p class="fine">사진은 다른 운동 사진처럼 파란 톤으로 바뀌고, 이 폰 안에만 저장돼요.</p></div>
    <p class="field-error" role="alert"></p>
    <button type="button" class="btn btn--primary btn--wide" data-act="save">${edit ? '저장' : '추가'}</button>`;

  const s = sheet({ title: edit ? '내 운동 고치기' : '내 운동 추가', wide: true, body: body(),
    onInput: (el) => { if (el.name === 'name') d.name = el.value; if (el.name === 'memo') d.memo = el.value; },
    actions: {
      muscle: (el) => { d.muscle = el.dataset.v; d.pattern = PATTERNS[d.muscle][0][0]; repaint(); },
      pattern: (el) => { d.pattern = el.dataset.v; repaint(); },
      equip: (el) => { d.equip = el.dataset.v; repaint(); },
      nophoto: () => { photo = null; repaint(); },
      save: async (_, f, close) => {
        const err = s.body.querySelector('.field-error');
        d.name = f.name.value.trim();
        if (!d.name) { err.textContent = '운동 이름을 넣어주세요.'; f.name.focus(); return; }
        if (!d.muscle) { err.textContent = '어느 부위 운동인지 골라주세요. 부위를 알아야 하루에 한 부위만 몰리지 않게 도와드릴 수 있어요.'; return; }
        const id = edit?.id || 'c_' + db.uid();
        const item = { id, name: d.name, muscle: d.muscle, pattern: d.pattern, equip: d.equip, memo: (f.memo.value || '').trim(), photo: !!photo };
        if (photo) { await db.setKv('exPhoto:' + id, photo); PHOTOS[id] = photo; } else { await db.del('kv', 'exPhoto:' + id); delete PHOTOS[id]; }
        const next = edit ? list.map((x) => (x.id === id ? item : x)) : [...list, item];
        await saveList(next);
        close();
        onSaved?.(id);
      },
    } });
  s.form.addEventListener('change', async (e) => {
    if (e.target.name !== 'photo' || !e.target.files[0]) return;
    try { photo = await toDuotone(e.target.files[0]); repaint(); } catch { notice('사진을 읽지 못했어요. 다른 사진으로 해보세요.'); }
  });
  function repaint() {
    const top = s.body.scrollTop;
    s.body.innerHTML = body();
    s.body.scrollTop = top;
  }
}

// 삭제: 지난 기록은 남기고, 플랜과 즐겨찾기에서 뺀다
export async function deleteCustom(id) {
  const list = await db.kv('customExercises', []);
  await saveList(list.map((x) => (x.id === id ? { ...x, deleted: true, photo: false } : x)));
  await db.del('kv', 'exPhoto:' + id);
  delete PHOTOS[id];
  const plan = await getPlan();
  if (plan) {
    for (const s of plan.sessions) s.items = s.items.filter((it) => it.exId !== id);
    await savePlan(plan);
  }
  const p = await getProfile();
  if (p?.favorites?.includes(id)) await saveProfile({ ...p, favorites: p.favorites.filter((x) => x !== id) });
}

export const isCustom = (id) => !!byId[id]?.custom;
