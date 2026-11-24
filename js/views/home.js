import * as db from '../db.js';
import { esc, sheet } from '../ui.js';
import { today, addDays, fmt, daysBetween, GOALS } from '../calc.js';
import { dailyTargets, mealsOn, sum, workouts, getPlan, bodyLog, intakeByDay, historyOf } from '../store.js';
import { recommend, bestSet } from '../planner.js';
import { byId } from '../data/exercises.js';
import { sparkline } from '../chart.js';
import { weightTrend } from './health.js';
import { applyChange } from './plan.js';

function weekReport(all, rows, intake, end = today()) {
  const start = addDays(end, -6);
  const ws = all.filter((w) => w.date >= start && w.date <= end && w.exercises.length);
  const cardioMin = all.filter((w) => w.date >= start && w.date <= end).reduce((t, w) => t + (w.cardio || []).reduce((u, c) => u + c.min, 0), 0);
  const volume = ws.reduce((s, w) => s + (w.volume || 0), 0);
  const days = Object.keys(intake).filter((d) => d >= start && d <= end);
  const avgKcal = days.length ? days.reduce((s, d) => s + intake[d], 0) / days.length : null;
  const w = rows.filter((r) => r.weight);
  const avgOf = (a, b) => { const x = w.filter((r) => r.date >= a && r.date <= b); return x.length ? x.reduce((s, r) => s + r.weight, 0) / x.length : null; };
  const nowAvg = avgOf(start, end), prevAvg = avgOf(addDays(start, -7), addDays(start, -1));
  let prs = 0;
  for (const wk of ws) {
    for (const e of wk.exercises) {
      const best = bestSet(e.sets)?.e1rm || 0;
      const before = Math.max(0, ...historyOf(all.filter((x) => x.startedAt < wk.startedAt), e.exId).map((h) => bestSet(h.sets)?.e1rm || 0));
      if (before && best > before) prs++;
    }
  }
  return { count: ws.length, cardioMin, volume, avgKcal, foodDays: days.length, change: nowAvg != null && prevAvg != null ? nowAvg - prevAvg : null, prs };
}

export async function render(root, ctx) {
  const p = ctx.profile;
  const [t, meals, all, plan, rows, active, intake] = await Promise.all([
    dailyTargets(p), mealsOn(today()), workouts(), getPlan(), bodyLog(), db.kv('active'), intakeByDay(addDays(today(), -13), today()),
  ]);
  const eaten = sum(meals);
  const left = t.budget - eaten.kcal;
  const rec = recommend(plan, all);
  const tr = weightTrend(rows);
  const rep = weekReport(all, rows, intake);
  const backupDue = !p.lastBackup ? daysBetween(p.createdAt, today()) >= 7 : daysBetween(p.lastBackup.slice(0, 10), today()) >= 7;
  const phaseDue = p.phase && today() >= p.phase.until;
  const w30 = rows.filter((r) => r.weight && r.date >= addDays(today(), -30)).map((r) => r.weight);

  root.innerHTML = `
    ${phaseDue ? `<section class="block block--alert"><h2>정해둔 기간이 끝났어요</h2>
      <p>지금은 ${esc(GOALS[p.goal].name)}. 계획대로 ${esc(GOALS[p.phase.next].name)}로 바꿀까요?</p>
      <div class="row-actions"><button type="button" class="btn" data-act="phase-keep">지금 목적 유지</button>
      <button type="button" class="btn btn--primary" data-act="phase-go">바꾸기</button></div></section>` : ''}
    ${backupDue ? `<section class="block block--alert"><p>마지막 백업 후 일주일이 지났어요. 폰을 바꾸거나 앱을 지우면 기록이 사라지니 백업 파일을 저장해두세요.</p>
      <div class="row-actions row-actions--plain"><a class="btn" href="#/settings">백업하러 가기</a></div></section>` : ''}

    <a class="block block--link budget" href="#/food">
      <span class="block-cap">오늘 먹을 수 있는 양</span>
      <span class="budget-left"><span class="measure figure-l${left < 0 ? ' over' : ''}">${fmt(Math.abs(left))}</span><span class="unit">kcal ${left < 0 ? '초과' : '남음'}</span></span>
      <span class="budget-row budget-row--inline">
        <span>목표 <span class="measure">${fmt(t.kcal)}</span></span><span>운동 <span class="measure">+${fmt(t.exercise)}</span></span>
        <span>단백질 <span class="measure">${fmt(eaten.p)}/${t.protein}g</span></span></span>
    </a>

    <section class="block" aria-labelledby="w-h">
      ${active ? `<div class="block-head"><h2 id="w-h">${esc(active.name)} 진행 중</h2></div>
        <div class="row-actions row-actions--plain"><a class="btn btn--primary btn--wide" href="#/workout">이어서 하기</a></div>`
      : rec ? `<div class="block-head"><h2 id="w-h">오늘은 ${esc(rec.session.name)}</h2><span class="muted measure">${rec.doneThisWeek}/${rec.target}회</span></div>
        <p class="muted">${rec.session.items.map((it) => esc(byId[it.exId].name)).join(', ')}</p>
        ${rec.note ? `<p class="note">${esc(rec.note)}</p>` : ''}
        ${rec.cardio?.target ? `<p class="muted">유산소 이번 주 <span class="measure">${rec.cardio.done}/${rec.cardio.target.times}</span>회, <span class="measure">${rec.cardio.minutes}</span>분</p>` : ''}
        ${rec.weekDone && !rec.trainedToday ? '<p class="note">이번 주 목표 횟수를 채웠어요. 쉬어도 됩니다.</p>' : ''}
        <div class="row-actions row-actions--plain"><a class="btn btn--primary btn--wide" href="#/workout">운동 시작</a></div>`
      : '<p class="empty">플랜 탭에서 플랜을 만들어주세요.</p>'}
    </section>

    <a class="block block--link" href="#/health">
      <span class="block-cap">체중 7일 평균</span>
      <span class="weight-line"><span><span class="measure figure">${tr ? fmt(tr.avg, 1) : fmt(p.weight, 1)}</span><span class="unit">kg</span></span>${sparkline(w30)}</span>
      ${tr?.perWeek != null ? `<span class="muted">주당 <span class="measure">${tr.perWeek > 0 ? '+' : ''}${fmt(tr.perWeek, 2)}kg</span></span>` : '<span class="muted">아침 공복 체중을 기록해보세요</span>'}
    </a>

    <section class="block" aria-labelledby="r-h">
      <div class="block-head"><h2 id="r-h">최근 7일</h2></div>
      <dl class="stats stats--grid">
        <div><dt>근력운동</dt><dd class="measure">${rep.count}<small>회</small></dd></div>
        <div><dt>유산소</dt><dd class="measure">${rep.cardioMin}<small>분</small></dd></div>
        <div><dt>총 볼륨</dt><dd class="measure">${fmt(rep.volume / 1000, 1)}<small>톤</small></dd></div>
        <div><dt>평균 섭취</dt><dd class="measure">${rep.avgKcal ? fmt(rep.avgKcal) : '-'}<small>${rep.avgKcal ? 'kcal' : ''}</small></dd></div>
        <div><dt>체중 변화</dt><dd class="measure">${rep.change != null ? `${rep.change > 0 ? '+' : ''}${fmt(rep.change, 1)}` : '-'}<small>${rep.change != null ? 'kg' : ''}</small></dd></div>
        <div><dt>기록 갱신</dt><dd class="measure">${rep.prs}<small>번</small></dd></div>
      </dl>
    </section>`;

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'phase-go') { await applyChange({ ...p, phase: null }, { goal: p.phase.next }); ctx.refresh(); }
    if (b.dataset.act === 'phase-keep') { const { saveProfile } = await import('../store.js'); await saveProfile({ ...p, phase: null }); ctx.refresh(); }
  };
}

export { sheet };
