import * as db from '../db.js';
import { esc, stepper, num, sheet, confirmSheet, notice, download } from '../ui.js';
import { ACTIVITY, GOALS, today, age, fmt } from '../calc.js';
import { saveProfile, dailyTargets } from '../store.js';
import { changeSheet } from './plan.js';

export async function render(root, ctx) {
  const p = ctx.profile;
  const t = await dailyTargets(p);
  const persisted = await navigator.storage?.persisted?.().catch(() => null);
  const counts = { workouts: (await db.all('workouts')).length, meals: (await db.all('meals')).length, body: (await db.all('body')).length };
  const act = ACTIVITY.find((a) => a.v === p.activity);

  root.innerHTML = `
    <section class="block" aria-labelledby="me-h">
      <div class="block-head"><h2 id="me-h">내 신체 정보</h2><button type="button" class="btn btn--small" data-act="me">고치기</button></div>
      <dl class="facts">
        <div><dt>성별, 나이</dt><dd>${p.sex === 'm' ? '남성' : '여성'}, <span class="measure">${age(p.birth)}</span>세</dd></div>
        <div><dt>키</dt><dd class="measure">${p.height}cm</dd></div>
        <div><dt>체지방률</dt><dd class="measure">${p.bodyFat ? p.bodyFat + '%' : '모름'}</dd></div>
        <div><dt>평소 활동</dt><dd>${esc(act?.name)}</dd></div>
        <div><dt>목표 체중</dt><dd class="measure">${p.targetWeight ? fmt(p.targetWeight, 1) + 'kg' : '없음'}</dd></div>
        <div><dt>하루 목표</dt><dd class="measure">${fmt(t.kcal)}kcal${t.usingAdaptive ? ' (실측)' : ''}</dd></div>
      </dl>
      <p class="fine">체중은 건강 탭에서 기록해요. 칼로리 목표는 가장 최근 체중으로 계산해요.</p>
    </section>

    <section class="block" aria-labelledby="goal-h">
      <div class="block-head"><h2 id="goal-h">${esc(GOALS[p.goal].name)}</h2><button type="button" class="btn btn--small" data-act="goal">목적·플랜 바꾸기</button></div>
    </section>

    <section class="block" aria-labelledby="bk-h">
      <div class="block-head"><h2 id="bk-h">백업</h2></div>
      <p>기록은 이 폰에만 있어요. 백업 파일을 아이폰 '파일' 앱이나 드라이브에 저장해두면 폰을 바꿔도 불러올 수 있어요.</p>
      <dl class="facts">
        <div><dt>마지막 백업</dt><dd class="measure">${p.lastBackup ? p.lastBackup.slice(0, 10) : '아직 없음'}</dd></div>
        <div><dt>저장된 기록</dt><dd>운동 <span class="measure">${counts.workouts}</span>, 식사 <span class="measure">${counts.meals}</span>, 몸 <span class="measure">${counts.body}</span></dd></div>
        <div><dt>자동 삭제 방지</dt><dd>${persisted ? '켜짐' : persisted === false ? '꺼짐, 홈 화면에 추가하면 켜져요' : '확인 불가'}</dd></div>
      </dl>
      <div class="row-actions">
        <button type="button" class="btn" data-act="import">백업 불러오기</button>
        <button type="button" class="btn btn--primary btn--wide" data-act="export">백업 파일 만들기</button>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
    </section>

    <section class="block" aria-labelledby="ab-h">
      <div class="block-head"><h2 id="ab-h">안내</h2></div>
      <ul class="rules">
        <li>음식 영양 정보: 식품의약품안전처 식품영양성분 데이터베이스 (공공데이터포털). 시판 제품과 술은 제품 라벨 평균값이에요.</li>
        <li>칼로리 계산: Mifflin-St Jeor, 체지방률이 있으면 Katch-McArdle. 운동 칼로리는 MET 기준 추정치예요.</li>
        <li>이 앱은 의료 기기가 아니에요. 질환이 있거나 약을 먹고 있다면 식단과 운동을 크게 바꾸기 전에 의사와 상담하세요.</li>
      </ul>
    </section>

    <div class="row-actions row-actions--plain"><button type="button" class="btn btn--danger" data-act="wipe">모든 기록 지우기</button></div>`;

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'goal') return changeSheet(p, () => ctx.refresh());
    if (a === 'me') return meSheet(p, ctx);
    if (a === 'export') return exportBackup(p, ctx);
    if (a === 'import') return root.querySelector('#import-file').click();
    if (a === 'wipe') {
      if (!(await confirmSheet('모든 기록 지우기', '운동, 식단, 체중 기록과 플랜이 모두 지워져요. 먼저 백업 파일을 만들어두세요.', '계속'))) return;
      if (!(await confirmSheet('정말 지울까요?', '되돌릴 수 없어요.', '모두 지우기', true))) return;
      await db.wipe(); location.hash = '#/home'; location.reload();
    }
  };
  root.onchange = async (e) => {
    if (e.target.id !== 'import-file') return;
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const n = (data.workouts || []).length;
      if (!(await confirmSheet('백업 불러오기', `${data.exportedAt?.slice(0, 10) || ''} 백업 (운동 ${n}회)으로 지금 기록을 모두 바꿔요.`, '불러오기', true))) return;
      await db.importAll(data);
      location.hash = '#/home'; location.reload();
    } catch (err) {
      notice(err instanceof SyntaxError ? '백업 파일을 읽을 수 없어요. 이 앱에서 만든 .json 파일인지 확인하세요.' : err.message);
    }
  };
}

async function exportBackup(p, ctx) {
  const data = await db.exportAll();
  const name = `운동기록-백업-${today()}.json`;
  const text = JSON.stringify(data);
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name });
    else download(name, text);
  } catch (err) {
    if (err.name === 'AbortError') return; // 공유 창을 닫음
    download(name, text);
  }
  await saveProfile({ ...p, lastBackup: new Date().toISOString() });
  ctx.refresh();
}

function meSheet(p, ctx) {
  const d = { ...p };
  const s = sheet({ title: '내 신체 정보', wide: true,
    body: `<fieldset class="group"><legend>성별</legend><div class="chips">
        <button type="button" class="chip" data-act="sex" data-v="m" aria-pressed="${d.sex === 'm'}">남성</button>
        <button type="button" class="chip" data-act="sex" data-v="f" aria-pressed="${d.sex === 'f'}">여성</button></div></fieldset>
      <label class="field"><span class="field-label">생년월일</span><input type="date" name="birth" value="${d.birth}" max="${today()}" autocomplete="bday"></label>
      <div class="field"><span class="field-label">키</span>${stepper({ name: 'height', value: d.height, step: 1, unit: 'cm', label: '키' })}</div>
      <div class="field"><span class="field-label">체지방률 (모르면 비워두기)</span>${stepper({ name: 'bodyFat', value: d.bodyFat ?? '', step: 0.5, unit: '%', label: '체지방률', decimal: true })}</div>
      <div class="field"><span class="field-label">목표 체중</span>${stepper({ name: 'targetWeight', value: d.targetWeight ?? '', step: 0.5, unit: 'kg', label: '목표 체중', decimal: true })}</div>
      <fieldset class="group"><legend>운동 말고 평소 활동</legend><div class="chips">${ACTIVITY.map((a) => `<button type="button" class="chip" data-act="act" data-v="${a.v}" aria-pressed="${d.activity === a.v}">${a.name}</button>`).join('')}</div></fieldset>
      <p class="field-error" role="alert"></p>
      <button type="button" class="btn btn--primary btn--wide" data-act="save">저장</button>`,
    actions: {
      sex: (el) => { d.sex = el.dataset.v; for (const c of s.body.querySelectorAll('[data-act="sex"]')) c.setAttribute('aria-pressed', c.dataset.v === d.sex); },
      act: (el) => { d.activity = Number(el.dataset.v); for (const c of s.body.querySelectorAll('[data-act="act"]')) c.setAttribute('aria-pressed', Number(c.dataset.v) === d.activity); },
      save: async (_, f, close) => {
        const h = num(f.height.value), bf = num(f.bodyFat.value);
        if (!f.birth.value || !h || h < 120 || h > 230 || (bf && (bf < 3 || bf > 60))) { s.body.querySelector('.field-error').textContent = '생년월일, 키(120~230cm), 체지방률(3~60%)을 확인하세요.'; return; }
        await saveProfile({ ...d, birth: f.birth.value, height: h, bodyFat: bf, targetWeight: num(f.targetWeight.value) });
        close(); ctx.refresh();
      },
    } });
}
