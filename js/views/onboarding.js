import { esc, stepper, num, icon } from '../ui.js';
import { GOALS, ACTIVITY, EXPERIENCE, INJURY, targets, today, age, fmt } from '../calc.js';
import { saveProfile, savePlan } from '../store.js';
import { buildPlan } from '../planner.js';
import * as db from '../db.js';

const choice = (field, value, label, hint, on) => `<button type="button" class="choice" data-set="${field}" data-value="${value}" aria-pressed="${on}">
  <span class="choice-name">${esc(label)}</span>${hint ? `<span class="choice-hint">${esc(hint)}</span>` : ''}</button>`;

export function render(root, { done }) {
  const p = { sex: null, birth: '', height: 170, weight: 70, bodyFat: null, muscle: null, activity: null, experience: null, days: null, sessionMin: 60, injuries: [], goal: null, targetWeight: null, autoAdjust: true };
  let i = 0;

  const STEPS = [
    { id: 'intro', render: () => `<h2 class="q">내 몸에 맞춘 운동·식단 기록을 시작해요.</h2>
        <p class="why">몇 가지만 물어볼게요. 1분이면 끝나요. 입력한 정보와 기록은 이 폰 안에만 저장되고 어디에도 보내지 않아요.</p>`, next: '시작하기' },
    { id: 'sex', render: () => `<h2 class="q">성별</h2><p class="why">남녀는 같은 체중이어도 기초대사량 계산식이 달라요.</p>
        <div class="choices">${choice('sex', 'm', '남성', '', p.sex === 'm')}${choice('sex', 'f', '여성', '', p.sex === 'f')}</div>`, ok: () => p.sex },
    { id: 'birth', render: () => `<h2 class="q">생년월일</h2><p class="why">나이가 들수록 기초대사량이 줄어서 필요해요. 생일이 지나면 나이는 자동으로 바뀌어요.</p>
        <label class="field"><span class="field-label">생년월일</span><input type="date" name="birth" value="${p.birth}" max="${today()}" min="1930-01-01" autocomplete="bday" required></label>`,
      ok: () => p.birth && age(p.birth) >= 14 && age(p.birth) < 100, err: '14세 이상만 사용할 수 있게 맞춰져 있어요.' },
    { id: 'height', render: () => `<h2 class="q">키</h2><p class="why">체중과 함께 기초대사량과 BMI를 계산해요.</p>
        ${stepper({ name: 'height', value: p.height, step: 1, unit: 'cm', label: '키' })}`, ok: () => p.height >= 120 && p.height <= 230, err: '120~230cm 사이로 입력하세요.' },
    { id: 'weight', render: () => `<h2 class="q">지금 체중</h2><p class="why">칼로리와 단백질 목표의 기준이에요. 나중에 체중을 기록하면 목표도 자동으로 다시 계산돼요.</p>
        ${stepper({ name: 'weight', value: p.weight, step: 0.5, unit: 'kg', label: '체중', decimal: true })}`, ok: () => p.weight >= 30 && p.weight <= 250, err: '30~250kg 사이로 입력하세요.' },
    { id: 'inbody', render: () => `<h2 class="q">인바디 결과가 있나요?</h2><p class="why">체지방률을 알면 근육량 기준 공식으로 기초대사량을 더 정확히 계산해요. 없으면 비워두고 넘어가세요.</p>
        <div class="field"><span class="field-label">체지방률</span>${stepper({ name: 'bodyFat', value: p.bodyFat ?? '', step: 0.5, unit: '%', label: '체지방률', decimal: true })}</div>
        <div class="field"><span class="field-label">골격근량</span>${stepper({ name: 'muscle', value: p.muscle ?? '', step: 0.5, unit: 'kg', label: '골격근량', decimal: true })}</div>`,
      ok: () => !p.bodyFat || (p.bodyFat >= 3 && p.bodyFat <= 60), err: '체지방률은 3~60% 사이여야 해요.', next: '다음', skip: true },
    { id: 'activity', render: () => `<h2 class="q">운동 말고 평소에는 얼마나 움직이나요?</h2><p class="why">운동으로 쓰는 칼로리는 운동을 기록할 때 따로 더해요. 여기서는 일상만 골라주세요.</p>
        <div class="choices">${ACTIVITY.map((a) => choice('activity', a.v, a.name, a.hint, p.activity === a.v)).join('')}</div>`, ok: () => p.activity },
    { id: 'experience', render: () => `<h2 class="q">웨이트 운동 경력</h2><p class="why">초보라면 자세 잡기 쉬운 머신 위주로, 경력이 있으면 바벨 위주로 플랜을 짜요.</p>
        <div class="choices">${Object.entries(EXPERIENCE).map(([k, v]) => choice('experience', k, v, '', p.experience === k)).join('')}</div>`, ok: () => p.experience },
    { id: 'days', render: () => `<h2 class="q">일주일에 며칠 헬스장에 갈 수 있나요?</h2><p class="why">횟수에 맞춰 전신, 상·하체, 밀기·당기기·하체 분할 중 하나로 짜요.</p>
        <div class="choices choices--row">${[2, 3, 4, 5, 6].map((d) => choice('days', d, `${d}일`, '', p.days === d)).join('')}</div>`, ok: () => p.days },
    { id: 'time', render: () => `<h2 class="q">한 번 운동할 때 쓸 수 있는 시간</h2><p class="why">시간에 맞춰 종목 수와 세트 수를 조절해요.</p>
        <div class="choices choices--row">${[45, 60, 75, 90].map((d) => choice('sessionMin', d, `${d}분`, '', p.sessionMin === d)).join('')}</div>`, ok: () => p.sessionMin },
    { id: 'injury', render: () => `<h2 class="q">아프거나 조심해야 하는 부위가 있나요?</h2><p class="why">고른 부위에 부담이 큰 종목은 플랜에서 빼고 다른 종목으로 바꿔요. 여러 개 고를 수 있어요.</p>
        <div class="choices choices--row">${Object.entries(INJURY).map(([k, v]) => `<button type="button" class="choice" data-toggle="${k}" aria-pressed="${p.injuries.includes(k)}"><span class="choice-name">${v}</span></button>`).join('')}</div>`,
      next: () => (p.injuries.length ? '다음' : '없어요') },
    { id: 'goal', render: () => `<h2 class="q">지금 운동 목적</h2><p class="why">언제든 바꿀 수 있어요. 바꾸면 플랜과 칼로리 목표만 새로 계산되고 기록은 그대로예요.</p>
        <div class="choices">${choice('goal', 'cut', GOALS.cut.name, '하루 300~500kcal 적게 먹고 근육은 지켜요', p.goal === 'cut')}
        ${choice('goal', 'bulk', GOALS.bulk.name, '조금 넉넉히 먹고 8~12회 위주로 해요', p.goal === 'bulk')}
        ${choice('goal', 'strength', GOALS.strength.name, '무거운 무게로 3~6회, 쉬는 시간 길게', p.goal === 'strength')}
        ${choice('goal', 'health', GOALS.health.name, '체중은 유지하고 근력·체력을 고르게', p.goal === 'health')}</div>`, ok: () => p.goal },
    { id: 'target', render: () => `<h2 class="q">목표 체중이 있나요?</h2><p class="why">있으면 지금 속도로 언제쯤 도달할지 보여줘요. 없으면 비워두세요.</p>
        ${stepper({ name: 'targetWeight', value: p.targetWeight ?? '', step: 0.5, unit: 'kg', label: '목표 체중', decimal: true })}`, skip: true },
    { id: 'result', render: () => {
      const t = targets(p, p.weight);
      const act = ACTIVITY.find((a) => a.v === p.activity);
      return `<h2 class="q">내 하루 목표</h2>
        <dl class="calc">
          <div><dt>기초대사량</dt><dd class="measure">${fmt(t.bmr)}<small>kcal</small></dd>
            <p>${t.method === 'katch' ? '체지방률로 구한 제지방량 기준 (Katch-McArdle)' : '키·체중·나이·성별 기준 (Mifflin-St Jeor)'}</p></div>
          <div><dt>하루 소모량</dt><dd class="measure">${fmt(t.formula)}<small>kcal</small></dd>
            <p>기초대사량 × ${p.activity} (${esc(act.name)}). 운동한 날은 운동 칼로리를 더해요.</p></div>
          <div><dt>목표 섭취</dt><dd class="measure">${fmt(t.kcal)}<small>kcal</small></dd>
            <p>${t.delta ? `소모량 ${t.delta > 0 ? '+' : ''}${t.delta}kcal (${GOALS[p.goal].name})` : '소모량과 같게 (유지)'}${t.floored ? '. 너무 낮아지지 않게 최저선으로 맞췄어요.' : ''}</p></div>
          <div><dt>단백질</dt><dd class="measure">${t.protein}<small>g</small></dd><p>체중 1kg당 ${t.proteinPerKg}g</p></div>
        </dl>
        <p class="fine">공식 계산은 사람마다 10~15% 차이가 나요. 2~3주 동안 체중과 식단을 기록하면 실제 몸에 맞게 자동으로 고쳐요. 질환이 있거나 약을 먹고 있다면 식단을 크게 바꾸기 전에 의사와 상담하세요.</p>`;
    }, next: '시작하기' },
  ];

  function paint(error = '') {
    const s = STEPS[i];
    const nextLabel = typeof s.next === 'function' ? s.next() : s.next || '다음';
    root.innerHTML = `<section class="onboard" aria-labelledby="ob-q">
      <div class="onboard-top">
        ${i > 0 ? `<button type="button" class="icon-btn" data-nav="back" aria-label="이전">${icon('left')}</button>` : '<span></span>'}
        <span class="measure onboard-count">${i + 1}/${STEPS.length}</span></div>
      <form class="onboard-body" novalidate>${s.render()}
        <p class="field-error" role="alert">${esc(error)}</p></form>
      <div class="onboard-actions">
        ${s.skip ? '<button type="button" class="btn" data-nav="skip">건너뛰기</button>' : ''}
        <button type="button" class="btn btn--primary btn--wide" data-nav="next">${esc(nextLabel)}</button></div>
    </section>`;
    root.querySelector('.q')?.setAttribute('id', 'ob-q');
  }

  function readInputs() {
    for (const el of root.querySelectorAll('input[name]')) {
      p[el.name] = el.type === 'date' ? el.value : num(el.value);
    }
  }

  root.oninput = readInputs;
  root.onclick = async (e) => {
    const set = e.target.closest('[data-set]');
    if (set) {
      const v = set.dataset.value;
      p[set.dataset.set] = isNaN(Number(v)) ? v : Number(v);
      paint();
      if (['sex', 'activity', 'experience', 'days', 'sessionMin', 'goal'].includes(set.dataset.set)) setTimeout(() => advance(), 140);
      return;
    }
    const tg = e.target.closest('[data-toggle]');
    if (tg) {
      const k = tg.dataset.toggle;
      p.injuries = p.injuries.includes(k) ? p.injuries.filter((x) => x !== k) : [...p.injuries, k];
      return paint();
    }
    const nav = e.target.closest('[data-nav]');
    if (!nav) return;
    if (nav.dataset.nav === 'back') { i = Math.max(0, i - 1); return paint(); }
    if (nav.dataset.nav === 'skip') {
      if (STEPS[i].id === 'inbody') { p.bodyFat = null; p.muscle = null; }
      if (STEPS[i].id === 'target') p.targetWeight = null;
      i++; return paint();
    }
    advance();
  };

  async function advance() {
    readInputs();
    const s = STEPS[i];
    if (s.ok && !s.ok()) return paint(s.err || '하나를 골라주세요.');
    if (i < STEPS.length - 1) { i++; return paint(); }
    await finish();
  }

  async function finish() {
    const profile = { ...p, createdAt: today(), goalHistory: [{ goal: p.goal, from: today() }], phase: null, lastBackup: null };
    await saveProfile(profile);
    await db.put('body', { date: today(), weight: p.weight, bodyFat: p.bodyFat, muscle: p.muscle });
    await savePlan(buildPlan(profile));
    done();
  }

  paint();
}
