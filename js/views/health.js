import * as db from '../db.js';
import { esc, stepper, num, sheet, notice } from '../ui.js';
import { today, addDays, parseYmd, fmt, bmi, movingAvg, slope, daysBetween, GOALS } from '../calc.js';
import { bodyLog, dailyTargets, saveProfile } from '../store.js';
import { lineChart } from '../chart.js';

const md = (d) => { const x = parseYmd(d); return `${x.getMonth() + 1}/${x.getDate()}`; };

export function weightTrend(rows, end = today()) {
  const w = rows.filter((r) => r.weight);
  if (!w.length) return null;
  const avg = movingAvg(w);
  const recent = w.filter((r) => daysBetween(r.date, end) <= 20);
  const perWeek = recent.length >= 4 ? slope(recent.map((r) => ({ x: daysBetween(recent[0].date, r.date), y: r.weight }))) * 7 : null;
  return { last: w.at(-1), avg: avg.at(-1).avg, avgSeries: avg, perWeek };
}

export async function render(root, ctx) {
  const p = ctx.profile;
  const rows = await bodyLog();
  const tr = weightTrend(rows);
  const t = await dailyTargets(p);
  const cur = tr?.avg ?? p.weight;
  const b = bmi(cur, p.height);
  const fastLoss = tr?.perWeek != null && tr.perWeek < -(cur * 0.01);
  let eta = '';
  if (p.targetWeight && tr?.perWeek) {
    const diff = p.targetWeight - cur;
    if (Math.abs(diff) < 0.3) eta = '목표 체중에 도달했어요.';
    else if (Math.sign(diff) === Math.sign(tr.perWeek) && Math.abs(tr.perWeek) > 0.05) {
      const weeks = Math.ceil(diff / tr.perWeek);
      const d = parseYmd(addDays(today(), weeks * 7));
      eta = `지금 속도면 <span class="measure">${d.getFullYear()}년 ${d.getMonth() + 1}월</span>쯤 ${fmt(p.targetWeight, 1)}kg에 도달해요.`;
    } else eta = `목표 ${fmt(p.targetWeight, 1)}kg과 반대 방향으로 움직이고 있어요.`;
  }
  const since = addDays(today(), -90);
  const w90 = rows.filter((r) => r.weight && r.date >= since);
  const markers = (p.goalHistory || []).slice(1).map((g) => ({ date: g.from, label: GOALS[g.goal].short }));
  const inbody = rows.filter((r) => r.bodyFat || r.muscle).reverse();
  const a = t.adaptive;

  root.innerHTML = `
    <div class="row-actions row-actions--plain"><button type="button" class="btn btn--primary btn--wide" data-act="log">오늘 몸 기록하기</button></div>

    <section class="block" aria-labelledby="w-h">
      <div class="block-head"><h2 id="w-h">체중</h2><span class="muted">7일 평균</span></div>
      <p class="budget-left"><span class="measure figure-l">${fmt(cur, 1)}</span><span class="unit">kg</span></p>
      <dl class="budget-row">
        <div><dt>주당 변화</dt><dd class="measure">${tr?.perWeek != null ? `${tr.perWeek > 0 ? '+' : ''}${fmt(tr.perWeek, 2)}kg` : '-'}</dd></div>
        <div><dt>BMI</dt><dd class="measure">${fmt(b, 1)}</dd></div>
        <div><dt>마지막 기록</dt><dd class="measure">${tr ? md(tr.last.date) : '-'}</dd></div>
      </dl>
      ${fastLoss ? '<p class="note note--warn">일주일에 체중의 1%보다 빠르게 빠지고 있어요. 근육도 함께 빠질 수 있으니 하루 100~200kcal 더 드세요.</p>' : ''}
      ${eta ? `<p class="note">${eta}</p>` : ''}
      ${w90.length > 1 ? lineChart({ points: w90.map((r) => ({ date: r.date, y: r.weight })), line: tr.avgSeries.filter((x) => x.date >= since).map((x) => ({ date: x.date, y: x.avg })), markers, label: '최근 90일 체중, 점은 기록, 선은 7일 평균', unit: 'kg' })
        : '<p class="empty">체중을 이틀 이상 기록하면 추세 그래프가 나와요. 아침 공복에 재면 가장 정확해요.</p>'}
    </section>

    <section class="block" aria-labelledby="tdee-h">
      <div class="block-head"><h2 id="tdee-h">내 실제 하루 소모량</h2></div>
      ${a.ready ? `<p class="budget-left"><span class="measure figure">${fmt(a.measured)}</span><span class="unit">kcal</span></p>
        <p class="muted">최근 3주 평균 섭취 <span class="measure">${fmt(a.avgIntake)}</span>kcal, 체중 변화 주당 <span class="measure">${fmt(a.kgPerWeek, 2)}</span>kg로 계산했어요. 공식값은 <span class="measure">${fmt(t.formula)}</span>kcal.</p>
        <label class="switch"><input type="checkbox" data-act="auto" ${p.autoAdjust !== false ? 'checked' : ''}><span>목표 칼로리에 실측값 쓰기</span></label>`
      : `<p class="muted">체중 8일, 식단 14일 이상 기록이 쌓이면 실제 몸에 맞는 소모량을 계산해요. 공식 계산은 사람마다 10~15% 차이가 나요.</p>
        <dl class="budget-row"><div><dt>체중 기록</dt><dd class="measure">${a.progress.weighDays}/8일</dd></div>
        <div><dt>식단 기록</dt><dd class="measure">${a.progress.foodDays}/14일</dd></div></dl>`}
    </section>

    ${inbody.length ? `<section class="block" aria-labelledby="ib-h"><div class="block-head"><h2 id="ib-h">인바디 기록</h2></div>
      <table class="table"><thead><tr><th scope="col">날짜</th><th scope="col">체중</th><th scope="col">체지방률</th><th scope="col">골격근량</th></tr></thead>
      <tbody>${inbody.slice(0, 12).map((r) => `<tr><td class="measure">${md(r.date)}</td><td class="measure">${r.weight ? fmt(r.weight, 1) : '-'}</td><td class="measure">${r.bodyFat ? fmt(r.bodyFat, 1) + '%' : '-'}</td><td class="measure">${r.muscle ? fmt(r.muscle, 1) : '-'}</td></tr>`).join('')}</tbody></table></section>` : ''}

    <section class="block" aria-labelledby="d-h"><div class="block-head"><h2 id="d-h">최근 기록</h2></div>
      ${rows.length ? `<table class="table"><thead><tr><th scope="col">날짜</th><th scope="col">체중</th><th scope="col">수면</th><th scope="col">물</th><th scope="col">걸음</th></tr></thead>
      <tbody>${rows.slice(-14).reverse().map((r) => `<tr data-act="edit" data-date="${r.date}"><td class="measure"><button type="button" class="link" data-act="edit" data-date="${r.date}">${md(r.date)}</button></td><td class="measure">${r.weight ? fmt(r.weight, 1) : '-'}</td><td class="measure">${r.sleep ? fmt(r.sleep, 1) + 'h' : '-'}</td><td class="measure">${r.water ? r.water + '잔' : '-'}</td><td class="measure">${r.steps ? fmt(r.steps) : '-'}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">아직 기록이 없어요.</p>'}
    </section>`;

  root.onclick = (e) => {
    const el = e.target.closest('button[data-act]');
    if (!el) return;
    if (el.dataset.act === 'log') logSheet(today());
    if (el.dataset.act === 'edit') logSheet(el.dataset.date);
  };
  root.onchange = async (e) => {
    if (e.target.dataset.act === 'auto') { await saveProfile({ ...p, autoAdjust: e.target.checked }); ctx.refresh(); }
  };

  async function logSheet(date) {
    const r = (await db.get('body', date)) || { date };
    const lastW = rows.filter((x) => x.weight).at(-1)?.weight ?? p.weight;
    const f = (name, label, step, unit, dec, val) => `<div class="field"><span class="field-label">${label}</span>${stepper({ name, value: val ?? '', step, unit, label, decimal: dec })}</div>`;
    sheet({ title: date === today() ? '오늘 몸 기록' : `${md(date)} 기록`, wide: true,
      body: `${f('weight', '체중', 0.1, 'kg', true, r.weight ?? lastW)}
        ${f('bodyFat', '체지방률 (인바디)', 0.5, '%', true, r.bodyFat)}
        ${f('muscle', '골격근량 (인바디)', 0.5, 'kg', true, r.muscle)}
        ${f('waist', '허리둘레', 0.5, 'cm', true, r.waist)}
        ${f('sleep', '수면', 0.5, '시간', true, r.sleep)}
        ${f('water', '물', 1, '잔', false, r.water)}
        ${f('steps', '걸음 수', 500, '보', false, r.steps)}
        <p class="fine">비워둔 칸은 저장하지 않아요. 걸음 수는 아이폰 건강 앱에서 보고 옮겨 적어주세요.</p>
        <button type="button" class="btn btn--primary btn--wide" data-act="save">저장</button>`,
      actions: { save: async (_, form, close) => {
        const v = {};
        for (const k of ['weight', 'bodyFat', 'muscle', 'waist', 'sleep', 'water', 'steps']) v[k] = num(form[k].value);
        await db.put('body', { ...r, ...v, date });
        const prof = { ...p };
        let msg = '';
        if (v.bodyFat) prof.bodyFat = v.bodyFat;
        if (v.muscle) prof.muscle = v.muscle;
        if (v.weight && Math.abs(v.weight - p.weight) >= 2) {
          msg = `체중이 ${fmt(Math.abs(v.weight - p.weight), 1)}kg 바뀌어서 칼로리 목표를 다시 계산했어요.`;
          prof.weight = v.weight;
        }
        await saveProfile(prof);
        close(); await ctx.refresh();
        if (msg) notice(msg);
      } } });
  }
}

export { esc };
