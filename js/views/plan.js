import { esc, icon, sheet, confirmSheet, exThumb, exAnim, notice } from '../ui.js';
import { GOALS, EXPERIENCE, INJURY, today, addDays, fmt, parseYmd } from '../calc.js';
import { byId, EQUIP, EXERCISES, MUSCLES } from '../data/exercises.js';
import { buildPlan, splitFor, deloadState, swapOptions, minutes, itemFor, weeklySets, weeklyTargets, weeklyDone, groupOf, GROUP_NAMES } from '../planner.js';
import { customForm } from '../custom.js';
import * as db from '../db.js';
import { getPlan, savePlan, saveProfile, getProfile, dailyTargets, workouts, historyOf } from '../store.js';
import { exerciseInfo, logCardio } from './workout.js';
import { recommend, CARDIO_PLAN } from '../planner.js';

// 조건 변경을 적용: 목적이 바뀌면 이력에 남기고 플랜을 새로 짠다 (지난 기록과 무게는 그대로)
export async function applyChange(profile, changes) {
  const next = { ...profile, ...changes };
  if (changes.goal && changes.goal !== profile.goal) {
    next.goalHistory = [...(profile.goalHistory || []), { goal: changes.goal, from: today() }];
  }
  await saveProfile(next);
  await rebuild(next);
  return next;
}

export async function rebuild(profile) {
  const old = await getPlan();
  await savePlan({ ...buildPlan(profile), next: old?.next || 0, createdAt: old?.createdAt || today(), skipDeloadWeek: old?.skipDeloadWeek ?? null });
}

const range = (arr) => { const lo = Math.min(...arr), hi = Math.max(...arr); return lo === hi ? `${lo}` : `${lo}~${hi}`; };

export function changeSheet(profile, onDone, focus = null) {
  const draft = { goal: profile.goal, days: profile.days, sessionMin: profile.sessionMin, experience: profile.experience, injuries: [...(profile.injuries || [])] };
  const opt = (field, v, label) => `<button type="button" class="chip" data-act="set" data-f="${field}" data-v="${v}" aria-pressed="${draft[field] === v}">${esc(label)}</button>`;
  const body = () => `
    <fieldset class="group"><legend>운동 목적</legend><div class="chips">${Object.entries(GOALS).map(([k, g]) => opt('goal', k, g.name)).join('')}</div></fieldset>
    <fieldset class="group"><legend>주 운동 일수</legend><div class="chips">${[2, 3, 4, 5, 6].map((d) => opt('days', d, `${d}일`)).join('')}</div></fieldset>
    <fieldset class="group"><legend>한 번 운동 시간</legend><div class="chips">${[45, 60, 75, 90].map((d) => opt('sessionMin', d, `${d}분`)).join('')}</div></fieldset>
    <fieldset class="group"><legend>운동 경력</legend><div class="chips">${Object.entries(EXPERIENCE).map(([k, v]) => opt('experience', k, v)).join('')}</div></fieldset>
    <fieldset class="group"><legend>조심할 부위</legend><div class="chips">${Object.entries(INJURY).map(([k, v]) => `<button type="button" class="chip" data-act="inj" data-v="${k}" aria-pressed="${draft.injuries.includes(k)}">${v}</button>`).join('')}</div></fieldset>
    <div id="preview" class="preview"></div>
    <button type="button" class="btn btn--primary btn--wide" data-act="apply">새 플랜으로 바꾸기</button>`;
  const s = sheet({ title: focus === 'goal' ? '운동 목적 바꾸기' : '플랜 조건 바꾸기', wide: true, body: body(),
    actions: {
      set: (el) => { const v = el.dataset.v; draft[el.dataset.f] = isNaN(Number(v)) ? v : Number(v); refresh(); },
      inj: (el) => { const k = el.dataset.v; draft.injuries = draft.injuries.includes(k) ? draft.injuries.filter((x) => x !== k) : [...draft.injuries, k]; refresh(); },
      apply: async (_, __, close) => { const p = await applyChange(profile, draft); close(); onDone(p); },
    } });
  async function refresh() {
    for (const c of s.body.querySelectorAll('[data-act="set"]')) c.setAttribute('aria-pressed', String(draft[c.dataset.f]) === c.dataset.v);
    for (const c of s.body.querySelectorAll('[data-act="inj"]')) c.setAttribute('aria-pressed', draft.injuries.includes(c.dataset.v));
    const before = await dailyTargets(profile);
    const after = await dailyTargets({ ...profile, ...draft });
    const cur = await getPlan();
    const nextPlan = buildPlan({ ...profile, ...draft });
    const cnt = (pl) => range(pl.sessions.map((x) => x.items.length));
    const mins = (pl) => range(pl.sessions.map(minutes));
    s.body.querySelector('#preview').innerHTML = `<h3 class="sheet-sub">바뀌는 점</h3><dl class="diff">
      <div><dt>하루 목표</dt><dd class="measure">${fmt(before.kcal)} <span class="muted">에서</span> ${fmt(after.kcal)}<small>kcal</small></dd></div>
      <div><dt>단백질</dt><dd class="measure">${before.protein} <span class="muted">에서</span> ${after.protein}<small>g</small></dd></div>
      <div><dt>분할</dt><dd>${esc(splitFor(draft.days).name)}</dd></div>
      ${cur ? `<div><dt>세션당 종목</dt><dd class="measure">${cnt(cur)} <span class="muted">에서</span> ${cnt(nextPlan)}<small>개</small></dd></div>
      <div><dt>세션 예상 시간</dt><dd class="measure">${mins(cur)} <span class="muted">에서</span> ${mins(nextPlan)}<small>분</small></dd></div>` : ''}</dl>
      ${cur?.edited ? '<p class="note note--warn">직접 고친 세션 내용은 새 플랜으로 바뀌어요.</p>' : ''}
      <p class="fine">지난 운동·식단·체중 기록과 종목별 최고기록은 그대로 남아요. 새 플랜도 지금까지 든 무게에서 이어서 추천해요.</p>`;
  }
  refresh();
}

export async function render(root, ctx) {
  const p = ctx.profile;
  let plan = await getPlan();
  if (!plan) { plan = buildPlan(p); await savePlan(plan); }
  const dl = deloadState(plan);
  const all = await workouts();
  const phase = p.phase;
  const upgraded = await db.kv('planUpgraded');
  if (upgraded) await db.del('kv', 'planUpgraded');
  const have = weeklySets(plan), want = weeklyTargets(p.goal), done = weeklyDone(all);
  const GN = GROUP_NAMES;
  const askPullup = !(p.favorites || []).includes('pullup') && !(await db.kv('pullupAsked'));

  root.innerHTML = `
    ${upgraded ? '<p class="note note--accent">플랜 규칙이 바뀌어서 새로 짰어요. 팔 운동이 모든 상체 세션에 들어가고, 유산소는 따로 기록하도록 빼서 부위별 주간 세트 수를 늘렸어요. 지금까지 든 무게는 그대로 이어서 추천해요.</p>' : ''}
    ${askPullup ? `<section class="block block--alert"><p>턱걸이를 좋아하신다고 하셨죠. 턱걸이를 등 운동에 우선 넣을까요? 추가 무게(벨트 원판)도 기록할 수 있어요.</p>
      <div class="row-actions"><button type="button" class="btn" data-act="pullup-no">괜찮아요</button>
      <button type="button" class="btn btn--primary" data-act="pullup-yes">턱걸이 우선 넣기</button></div></section>` : ''}
    <section class="block" aria-labelledby="goal-h">
      <div class="block-head"><h2 id="goal-h">${esc(GOALS[p.goal].name)}</h2>
        <button type="button" class="btn btn--small" data-act="change-goal">목적 바꾸기</button></div>
      <dl class="facts">
        <div><dt>분할</dt><dd>${esc(plan.split)}</dd></div>
        <div><dt>주 횟수</dt><dd class="measure">${p.days}일</dd></div>
        <div><dt>1회 시간</dt><dd class="measure">${p.sessionMin}분</dd></div>
        <div><dt>경력</dt><dd>${esc(EXPERIENCE[p.experience])}</dd></div>
        <div><dt>조심할 부위</dt><dd>${p.injuries?.length ? p.injuries.map((k) => INJURY[k]).join(', ') : '없음'}</dd></div>
        <div><dt>가벼운 주</dt><dd>${dl.isDeload ? '이번 주' : `<span class="measure">${dl.weeksLeft}</span>주 뒤`}</dd></div>
      </dl>
      <div class="row-actions row-actions--plain">
        <button type="button" class="btn" data-act="change">조건 바꾸기</button>
        <button type="button" class="btn" data-act="phase">${phase ? '기간 설정 바꾸기' : '기간 정해두기'}</button>
      </div>
      ${phase ? `<p class="note">지금 목적은 <span class="measure">${md(phase.until)}</span>까지예요. 그다음 목적은 ${esc(GOALS[phase.next].name)}. 그날이 되면 바꿀지 홈에서 물어볼게요.</p>` : ''}
    </section>

    ${plan.sessions.map((s, i) => `<section class="block" aria-labelledby="s-${i}">
      <div class="block-head"><h2 id="s-${i}">${esc(s.name)}</h2><span class="muted">약 <span class="measure">${minutes(s)}</span>분, <span class="measure">${s.items.length}</span>종목${i === plan.next % plan.sessions.length ? ', 다음 차례' : ''}</span></div>
      <ul class="rows">${s.items.map((it, j) => {
        const ex = byId[it.exId];
        const last = historyOf(all, it.exId)[0];
        const top = last ? Math.max(0, ...last.sets.filter((x) => !x.warm).map((x) => x.w || 0)) : 0;
        return `<li><button type="button" class="row" data-act="item" data-s="${i}" data-j="${j}">${exThumb(ex.id)}
          <span class="row-main"><span>${esc(ex.name)}</span><span class="muted">${EQUIP[ex.equip]}${top ? `, 최근 ${top}kg` : ''}</span></span>
          <span class="row-side measure">${it.sets}×${it.lo}-${it.hi}</span></button></li>`;
      }).join('')}</ul>
      <div class="row-actions row-actions--plain"><button type="button" class="btn btn--small" data-act="edit" data-s="${i}">이 세션 고치기</button></div>
    </section>`).join('')}

    ${(() => { const r = recommend(plan, all); const t = plan.cardio || CARDIO_PLAN[p.goal]; return `<section class="block" aria-labelledby="cardio-h">
      <div class="block-head"><h2 id="cardio-h">유산소 (따로)</h2><span class="measure muted">${r.cardio.done}/${t.times}회</span></div>
      <p class="muted">주 ${t.times}회, 한 번에 <span class="measure">${t.min}</span>분. 근력 세션과 따로 기록해요. 이번 주 <span class="measure">${r.cardio.minutes}</span>분 했어요.</p>
      <div class="row-actions row-actions--plain"><button type="button" class="btn" data-act="cardio">유산소 기록하기</button></div>
    </section>`; })()}

    <section class="block" aria-labelledby="vol-h">
      <div class="block-head"><h2 id="vol-h">부위별 주간 세트</h2></div>
      <table class="table"><thead><tr><th scope="col">부위</th><th scope="col">플랜</th><th scope="col">이번 주 한 것</th><th scope="col">목표</th></tr></thead>
        <tbody>${Object.keys(GN).map((g) => `<tr><th scope="row">${GN[g]}</th>
        <td class="measure">${Math.round(have[g] || 0)}</td><td class="measure${(done[g] || 0) >= want[g] ? ' accent' : ''}">${done[g] || 0}</td><td class="measure muted">${want[g]}+</td></tr>`).join('')}</tbody></table>
      ${Object.keys(GN).some((g) => (have[g] || 0) < want[g] - 0.5) ? `<p class="fine">목표보다 적은 부위는 한 번 운동 시간(${p.sessionMin}분) 안에 다 넣지 못한 거예요. 시간을 늘리면 채워져요.</p>` : ''}
    </section>

    <section class="block">
      <h2>규칙</h2>
      <ul class="rules">
        <li>위쪽 몸을 쓰는 세션에는 팔 운동(이두·삼두)이 꼭 들어가요.</li>
        <li>유산소는 근력 세션에 넣지 않고 따로 기록해요. 근력 세션 시간은 모두 근력운동에 써요.</li>
        <li>부위마다 주 ${want.chest}세트 이상이 되도록, 정한 운동 시간 안에서 세트를 늘려요. 시간이 더 있으면 종목과 세트를 더 넣되, 한 부위가 한 세션에 10세트, 일주일에 20세트를 넘지 않게 해요.</li>
        <li>별표한 운동(예: 턱걸이)은 같은 동작 자리에 먼저 들어가요.</li>
        <li>목표 반복수 윗값을 모든 세트에서 채우면 다음엔 상체 2.5kg, 하체 5kg 올려요.</li>
        <li>같은 무게에서 3번 연속 아랫값을 못 채우면 10% 낮춰 다시 쌓아요.</li>
        <li>${plan.deloadEvery}주마다 1주는 무게 10%, 세트 1개를 줄여 회복해요.</li>
        <li>어제 쓴 부위와 겹치면 다른 세션을 먼저 추천해요.</li>
      </ul>
      <div class="row-actions row-actions--plain"><button type="button" class="btn" data-act="rebuild">플랜 처음부터 다시 짜기</button></div>
    </section>`;

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'change' || act === 'change-goal') return changeSheet(p, () => ctx.refresh(), act === 'change-goal' ? 'goal' : null);
    if (act === 'phase') return phaseSheet(p, ctx);
    if (act === 'cardio') return logCardio(p, plan.cardio, () => ctx.refresh());
    if (act === 'pullup-yes') { await db.setKv('pullupAsked', true); const np = { ...p, favorites: [...new Set([...(p.favorites || []), 'pullup'])] }; await saveProfile(np); await rebuild(np); notice('턱걸이를 우선 넣어 플랜을 다시 짰어요.'); return ctx.refresh(); }
    if (act === 'pullup-no') { await db.setKv('pullupAsked', true); return ctx.refresh(); }
    if (act === 'edit') return editSession(plan, Number(b.dataset.s), p, all, ctx);
    if (act === 'rebuild') {
      if (await confirmSheet('플랜 다시 짜기', '직접 바꾼 종목이 기본값으로 돌아가요. 별표한 운동과 운동 기록은 그대로예요.', '다시 짜기')) { await rebuild(p); ctx.refresh(); }
    }
    if (act === 'item') {
      const s = plan.sessions[b.dataset.s], j = Number(b.dataset.j);
      const it = s.items[j];
      const opts = swapOptions(it.exId, p);
      sheet({ title: byId[it.exId].name, wide: true,
        body: `${exAnim(it.exId, byId[it.exId].name)}
          <div class="row-actions row-actions--plain"><button type="button" class="btn" data-act="info">자세 요점과 기록 보기</button></div>
          <h3 class="sheet-sub">다른 종목으로 바꾸기</h3>
          <ul class="rows">${opts.map((o) => `<li><button type="button" class="row" data-act="pick" data-id="${o.id}">${exThumb(o.id)}
            <span class="row-main"><span>${esc(o.name)}</span><span class="muted">${EQUIP[o.equip]}${o.custom ? ', 내 운동' : ''}${o.hurts ? ', 아픈 부위에 부담' : ''}</span></span></button></li>`).join('')}</ul>
          <div class="row-actions row-actions--plain"><button type="button" class="btn" data-act="new">${icon('plus')}내 운동 추가</button></div>`,
        actions: {
          info: (_, __, close) => { close(); exerciseInfo(it.exId, all, () => ctx.refresh()); },
          pick: async (el, _, close) => { await put(el.dataset.id); close(); },
          new: (_, __, close) => { close(); customForm({ muscle: byId[it.exId].muscle, onSaved: (id) => put(id) }); },
        } });
      async function put(id) {
        s.items[j] = { ...itemFor(byId[id], p), sets: it.sets };
        plan.edited = true;
        await savePlan(plan); ctx.refresh();
      }
    }
  };
}

const md = (d) => { const x = parseYmd(d); return `${x.getMonth() + 1}월 ${x.getDate()}일`; };

// 세션 직접 고치기: 종목 추가·빼기·순서·세트 수. 부위별 세트를 보면서 고친다
function editSession(plan, si, p, all, ctx) {
  const ses = plan.sessions[si];
  const want = weeklyTargets(p.goal);
  let adding = null; // 추가할 부위
  const groupSets = () => {
    const out = {};
    for (const it of ses.items) { const g = groupOf(it.exId); if (g) out[g] = (out[g] || 0) + it.sets; }
    return out;
  };
  const body = () => {
    const here = groupSets(), week = weeklySets(plan);
    const over = Object.entries(here).filter(([, n]) => n > 10).map(([g]) => GROUP_NAMES[g]);
    const short = Object.keys(want).filter((g) => (week[g] || 0) < want[g] - 0.5).map((g) => `${GROUP_NAMES[g]} ${Math.round(want[g] - (week[g] || 0))}`);
    return `<p class="muted">약 <span class="measure">${minutes(ses)}</span>분 (정한 시간 ${p.sessionMin}분), 이 세션 부위별: ${Object.entries(here).map(([g, n]) => `${GROUP_NAMES[g]} <span class="measure">${n}</span>`).join(', ') || '없음'}</p>
      ${over.length ? `<p class="note note--warn">${over.join(', ')}이 한 세션에 10세트를 넘어요. 효과보다 피로가 커질 수 있어요.</p>` : ''}
      ${short.length ? `<p class="note">플랜 전체로 보면 이번 주 부족한 부위: ${short.join(', ')}세트</p>` : ''}
      ${minutes(ses) > p.sessionMin + 5 ? '<p class="note note--warn">정한 운동 시간보다 길어졌어요.</p>' : ''}
      <ul class="rows">${ses.items.map((it, j) => `<li class="edit-row" data-j="${j}">${exThumb(it.exId)}
        <span class="row-main"><span>${esc(byId[it.exId]?.name || it.exId)}</span><span class="muted measure">${it.sets}세트 × ${it.lo}-${it.hi}</span></span>
        <span class="edit-tools">
          <button type="button" class="icon-btn" data-act="less" aria-label="세트 줄이기">${icon('minus')}</button>
          <button type="button" class="icon-btn" data-act="more" aria-label="세트 늘리기">${icon('plus')}</button>
          <button type="button" class="icon-btn" data-act="up" aria-label="위로" ${j ? '' : 'disabled'}>${icon('left')}</button>
          <button type="button" class="icon-btn" data-act="drop" aria-label="빼기">${icon('trash')}</button></span></li>`).join('')}</ul>
      <h3 class="sheet-sub">종목 추가</h3>
      <div class="chips" role="group" aria-label="부위">${Object.entries(MUSCLES).map(([m, name]) => {
        const g = groupOf(EXERCISES.find((e) => e.muscle === m)?.id);
        return `<button type="button" class="chip" data-act="m" data-m="${m}" aria-pressed="${adding === m}">${name}${g ? ` <span class="measure">${here[g] || 0}</span>` : ''}</button>`;
      }).join('')}</div>
      ${adding ? `<ul class="rows">${EXERCISES.filter((e) => e.muscle === adding && !ses.items.some((it) => it.exId === e.id)).map((e) => `<li><button type="button" class="row" data-act="add" data-id="${e.id}">${exThumb(e.id)}
        <span class="row-main"><span>${esc(e.name)}</span><span class="muted">${EQUIP[e.equip]}${e.custom ? ', 내 운동' : ''}</span></span>${icon('plus')}</button></li>`).join('')}</ul>
        <div class="row-actions row-actions--plain"><button type="button" class="btn" data-act="new">${icon('plus')}내 운동 추가</button></div>` : '<p class="fine">부위를 고르면 그 부위 종목이 나와요. 부위 옆 숫자는 이 세션의 세트 수예요.</p>'}
      <button type="button" class="btn btn--primary btn--wide" data-act="close">완료</button>`;
  };
  const sv = async () => { plan.edited = true; await savePlan(plan); const top = sh.body.scrollTop; sh.body.innerHTML = body(); sh.body.scrollTop = top; };
  const jOf = (el) => Number(el.closest('[data-j]').dataset.j);
  const sh = sheet({ title: `${ses.name} 고치기`, wide: true, body: body(),
    actions: {
      less: (el) => { const it = ses.items[jOf(el)]; if (it.sets > 1) it.sets--; sv(); },
      more: (el) => { const it = ses.items[jOf(el)]; if (it.sets < 8) it.sets++; sv(); },
      up: (el) => { const j = jOf(el); if (j > 0) [ses.items[j - 1], ses.items[j]] = [ses.items[j], ses.items[j - 1]]; sv(); },
      drop: (el) => { ses.items.splice(jOf(el), 1); sv(); },
      m: (el) => { adding = adding === el.dataset.m ? null : el.dataset.m; sv(); },
      add: (el) => { ses.items.push(itemFor(byId[el.dataset.id], p)); sv(); },
      new: (_, __, close) => { close(); customForm({ muscle: adding, onSaved: async (id) => { ses.items.push(itemFor(byId[id], p)); plan.edited = true; await savePlan(plan); ctx.refresh(); } }); },
    } });
  sh.el.addEventListener('close', () => ctx.refresh());
}

function phaseSheet(p, ctx) {
  let weeks = 8, next = p.goal === 'cut' ? 'bulk' : 'cut';
  const chips = () => `<fieldset class="group"><legend>지금 목적을 몇 주 동안</legend><div class="chips">${[4, 6, 8, 12, 16].map((w) => `<button type="button" class="chip" data-act="w" data-v="${w}" aria-pressed="${w === weeks}">${w}주</button>`).join('')}</div></fieldset>
    <fieldset class="group"><legend>그다음 목적</legend><div class="chips">${Object.entries(GOALS).filter(([k]) => k !== p.goal).map(([k, g]) => `<button type="button" class="chip" data-act="n" data-v="${k}" aria-pressed="${k === next}">${g.name}</button>`).join('')}</div></fieldset>
    <p class="fine">기간이 끝나면 홈 화면에서 바꿀지 물어봐요. 자동으로 바뀌지는 않아요.</p>
    <div class="row-actions">${p.phase ? '<button type="button" class="btn" data-act="clear">기간 설정 없애기</button>' : ''}
    <button type="button" class="btn btn--primary btn--wide" data-act="save">저장</button></div>`;
  const s = sheet({ title: '기간 정해두기', body: chips(), actions: {
    w: (el) => { weeks = Number(el.dataset.v); s.body.innerHTML = chips(); },
    n: (el) => { next = el.dataset.v; s.body.innerHTML = chips(); },
    save: async (_, __, close) => { await saveProfile({ ...p, phase: { until: addDays(today(), weeks * 7), next } }); close(); ctx.refresh(); },
    clear: async (_, __, close) => { await saveProfile({ ...p, phase: null }); close(); ctx.refresh(); },
  } });
}

export { icon };
