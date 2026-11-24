import * as db from '../db.js';
import { esc, icon, stepper, num, sheet, confirmSheet, notice, startRest, stopRest, keepAwake, exThumb, exAnim } from '../ui.js';
import { EXERCISES, MUSCLES, EQUIP, CARDIO, byId } from '../data/exercises.js';
import { suggest, warmups, recommend, deloadState, swapOptions, bestSet, minutes as estMinutes } from '../planner.js';
import { getPlan, savePlan, workouts as allWorkouts, historyOf, currentWeight, workoutKcal } from '../store.js';
import { today, fmt, e1rm, kcalFromMet, parseYmd } from '../calc.js';
import { lineChart } from '../chart.js';

const md = (d) => { const x = parseYmd(d); return `${x.getMonth() + 1}월 ${x.getDate()}일`; };
const hm = (ts) => { const d = new Date(ts); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const setsText = (sets) => sets.filter((s) => s.done && !s.warm).map((s) => (s.w ? `${s.w}×${s.r}` : `${s.r}회`)).join(', ');

export async function render(root, ctx) {
  const active = await db.kv('active');
  if (active) return renderActive(root, ctx, active);
  return renderStart(root, ctx);
}

// ---------------- 시작 전: 오늘의 추천 + 지난 기록 ----------------
async function renderStart(root, ctx) {
  const p = ctx.profile;
  const plan = await getPlan();
  const all = await allWorkouts();
  const rec = recommend(plan, all);
  const dl = plan ? deloadState(plan) : null;
  const s = rec?.session;

  const items = s ? s.items.map((it) => {
    const ex = byId[it.exId];
    const sug = suggest(it, historyOf(all, it.exId), dl?.isDeload);
    return `<li><button type="button" class="plan-row" data-act="info" data-ex="${ex.id}">${exThumb(ex.id)}<span class="plan-name">${esc(ex.name)}</span>
      <span class="plan-scheme measure">${dl?.isDeload ? Math.max(2, it.sets - 1) : it.sets}×${it.lo}-${it.hi}</span>
      <span class="plan-weight measure">${sug.weight ? `${sug.weight}kg` : ''}</span></button></li>`;
  }).join('') : '';

  const exHist = [...new Set(all.flatMap((w) => w.exercises.map((e) => e.exId)))]
    .map((id) => ({ id, best: Math.max(0, ...historyOf(all, id).map((h) => bestSet(h.sets)?.e1rm || 0)) }))
    .filter((x) => byId[x.id]);

  root.innerHTML = `
    ${s ? `<section class="block" aria-labelledby="today-h">
      <div class="block-head"><h2 id="today-h">${esc(s.name)}</h2><span class="measure muted">약 ${estMinutes(s)}분</span></div>
      ${rec.trainedToday ? '<p class="note">오늘 이미 운동을 기록했어요. 한 번 더 해도 됩니다.</p>' : ''}
      ${rec.weekDone && !rec.trainedToday ? `<p class="note">이번 주 목표 ${rec.target}회를 채웠어요. 오늘은 쉬어도 됩니다.</p>` : ''}
      ${rec.note ? `<p class="note">${esc(rec.note)}</p>` : ''}
      ${dl?.isDeload ? `<p class="note note--accent">이번 주는 가볍게 가는 주예요. 무게 10%, 세트 하나씩 줄였어요. <button type="button" class="link" data-act="skip-deload">이번 주는 그대로 하기</button></p>` : ''}
      <ul class="plan-list">${items}</ul>
      ${s.cardio ? `<p class="muted">마무리 유산소 ${s.cardio}분</p>` : ''}
      <div class="row-actions">
        <button type="button" class="btn" data-act="pick">다른 세션</button>
        <button type="button" class="btn btn--primary btn--wide" data-act="start" data-idx="${rec.idx}">이 루틴으로 시작</button>
      </div>
    </section>` : `<section class="block"><p class="empty">플랜이 없어요. 플랜 탭에서 만들 수 있어요.</p></section>`}
    <div class="row-actions row-actions--plain"><button type="button" class="btn" data-act="blank">빈 운동으로 시작</button></div>

    <section class="block" aria-labelledby="hist-h">
      <div class="block-head"><h2 id="hist-h">지난 운동</h2><span class="measure muted">${all.length}회</span></div>
      ${all.length ? `<ul class="rows">${all.slice(0, 30).map((w) => `<li><button type="button" class="row" data-act="open" data-id="${w.id}">
        <span class="row-main"><span>${esc(w.name)}</span><span class="muted">${md(w.date)}</span></span>
        <span class="row-side measure">${fmt(w.volume)}kg</span></button></li>`).join('')}</ul>`
      : '<p class="empty">아직 기록이 없어요. 첫 운동을 시작하면 여기에 쌓여요.</p>'}
    </section>

    ${exHist.length ? `<section class="block" aria-labelledby="ex-h">
      <div class="block-head"><h2 id="ex-h">종목별 기록</h2><span class="muted">추정 1RM</span></div>
      <ul class="rows">${exHist.sort((a, b) => b.best - a.best).map((x) => `<li><button type="button" class="row" data-act="info" data-ex="${x.id}">${exThumb(x.id)}
        <span class="row-main"><span>${esc(byId[x.id].name)}</span></span><span class="row-side measure">${x.best ? fmt(x.best, 1) + 'kg' : '-'}</span></button></li>`).join('')}</ul>
    </section>` : ''}`;

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'start') return start(Number(b.dataset.idx));
    if (act === 'blank') return start(null);
    if (act === 'pick') {
      sheet({ title: '세션 고르기', body: `<ul class="rows">${plan.sessions.map((x, i) => `<li><button type="button" class="row" data-act="go" data-idx="${i}">
        <span class="row-main"><span>${esc(x.name)}</span><span class="muted">${x.items.map((it) => esc(byId[it.exId].name)).slice(0, 3).join(', ')}</span></span></button></li>`).join('')}</ul>`,
        actions: { go: (el, _, close) => { close(); start(Number(el.dataset.idx)); } } });
    }
    if (act === 'skip-deload') { plan.skipDeloadWeek = dl.week; await savePlan(plan); ctx.refresh(); }
    if (act === 'open') openWorkout(all.find((w) => w.id === b.dataset.id), ctx);
    if (act === 'info') exerciseInfo(b.dataset.ex, all);
  };

  async function start(idx) {
    const session = idx == null ? null : plan.sessions[idx];
    const exercises = session ? session.items.map((it) => {
      const hist = historyOf(all, it.exId);
      const sug = suggest(it, hist, dl?.isDeload);
      const n = dl?.isDeload ? Math.max(2, it.sets - 1) : it.sets;
      const lastWork = hist[0]?.sets.filter((x) => !x.warm && x.done) || [];
      const sets = Array.from({ length: n }, (_, k) => ({ w: sug.weight, r: sug.kind === 'up' ? it.lo : (lastWork[k]?.r ?? it.lo), done: false, warm: false }));
      return { exId: it.exId, target: { sets: n, lo: it.lo, hi: it.hi, rest: it.rest }, sug, sets: [...warmups(it.exId, sug.weight), ...sets] };
    }) : [];
    const a = { id: db.uid(), date: today(), startedAt: Date.now(), planIdx: idx, name: session ? session.name : '자유 운동', cardioPlan: session?.cardio || 0, exercises, cardio: [] };
    await db.setKv('active', a);
    keepAwake(true);
    ctx.refresh();
  }
}

// ---------------- 운동 중 ----------------
function renderActive(root, ctx, a) {
  let saveT;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => db.setKv('active', a), 200); };
  let allCache = null;
  const all = async () => (allCache ??= await allWorkouts());

  const setRow = (k, s, j) => {
    const workNo = a.exercises[k].sets.slice(0, j + 1).filter((x) => !x.warm).length;
    const ex = byId[a.exercises[k].exId];
    return `<div class="set${s.done ? ' set--done' : ''}${s.warm ? ' set--warm' : ''}" data-k="${k}" data-j="${j}">
      <span class="set-no measure" aria-label="${s.warm ? '워밍업 세트' : `${workNo}세트`}">${s.warm ? '웜업' : workNo}</span>
      ${ex.equip === 'body' ? '<span class="set-bw">맨몸</span>' : stepper({ name: 'w', value: s.w ?? '', step: ex.inc || 2.5, label: '무게 kg', decimal: true })}
      ${stepper({ name: 'r', value: s.r ?? '', step: 1, label: ex.id === 'plank' ? '시간 초' : '반복수' })}
      <button type="button" class="check" data-act="done" aria-pressed="${s.done}" aria-label="${s.done ? '완료 취소' : '세트 완료'}">${icon('check')}</button>
    </div>`;
  };

  const block = (e, k) => {
    const ex = byId[e.exId];
    return `<article class="ex" data-k="${k}">
      <header class="ex-head">
        <button type="button" class="ex-title" data-act="info">${exThumb(ex.id)}<span class="ex-name">${esc(ex.name)}</span></button>
        <div class="ex-tools">
          <button type="button" class="icon-btn" data-act="swap" aria-label="${esc(ex.name)} 다른 종목으로 바꾸기">${icon('swap')}</button>
          <button type="button" class="icon-btn" data-act="remove" aria-label="${esc(ex.name)} 빼기">${icon('trash')}</button>
        </div>
      </header>
      ${e.target ? `<p class="ex-target muted">목표 <span class="measure">${e.target.lo}-${e.target.hi}회</span>, 휴식 <span class="measure">${Math.round(e.target.rest / 60 * 10) / 10}분</span></p>` : ''}
      ${e.sug ? `<p class="ex-sug ex-sug--${e.sug.kind}">${esc(e.sug.text)}</p>` : ''}
      <div class="set set--head" aria-hidden="true"><span>세트</span><span>${ex.equip === 'body' ? '' : '무게 kg'}</span><span>${ex.id === 'plank' ? '초' : '횟수'}</span><span></span></div>
      <div class="sets">${e.sets.map((s, j) => setRow(k, s, j)).join('')}</div>
      <div class="ex-actions">
        <button type="button" class="btn btn--small" data-act="add-set">${icon('plus')}세트</button>
        <button type="button" class="btn btn--small" data-act="same">지난번과 같게</button>
      </div>
    </article>`;
  };

  const paint = () => {
    const doneSets = a.exercises.reduce((s, e) => s + e.sets.filter((x) => x.done && !x.warm).length, 0);
    root.innerHTML = `<section class="session" aria-labelledby="sess-h">
      <div class="session-head"><h2 id="sess-h">${esc(a.name)}</h2>
        <span class="muted">시작 <span class="measure">${hm(a.startedAt)}</span>, 완료 <span class="measure">${doneSets}</span>세트</span></div>
      ${a.exercises.map(block).join('') || '<p class="empty">종목을 추가해서 시작하세요.</p>'}
      ${a.cardio.length ? `<section class="block"><h3>유산소</h3><ul class="rows">${a.cardio.map((c, i) => `<li class="row row--static">
        <span class="row-main"><span>${esc(CARDIO.find((x) => x.id === c.type).name)}</span><span class="muted measure">${c.min}분${c.speed ? `, ${c.speed}km/h` : ''}${c.incline ? `, 경사 ${c.incline}` : ''}</span></span>
        <span class="row-side measure">${c.kcal}kcal</span>
        <button type="button" class="icon-btn" data-act="del-cardio" data-i="${i}" aria-label="유산소 기록 지우기">${icon('trash')}</button></li>`).join('')}</ul></section>` : ''}
      ${a.cardioPlan && !a.cardio.length ? `<p class="note">마무리 유산소 ${a.cardioPlan}분이 플랜에 있어요.</p>` : ''}
      <div class="row-actions">
        <button type="button" class="btn" data-act="add-ex">${icon('plus')}종목</button>
        <button type="button" class="btn" data-act="add-cardio">${icon('plus')}유산소</button>
      </div>
      <div class="row-actions row-actions--end">
        <button type="button" class="btn btn--quiet" data-act="discard">기록 취소</button>
        <button type="button" class="btn btn--primary btn--wide" data-act="finish">운동 끝내기</button>
      </div>
    </section>`;
  };

  root.oninput = (e) => {
    const row = e.target.closest('.set');
    if (!row) return;
    const s = a.exercises[row.dataset.k].sets[row.dataset.j];
    s[e.target.name] = num(e.target.value);
    save();
  };

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const k = Number(b.closest('[data-k]')?.dataset.k);
    const ex = a.exercises[k];
    if (act === 'done') {
      const row = b.closest('.set');
      const s = ex.sets[row.dataset.j];
      s.done = !s.done;
      if (s.done && s.r == null) s.r = ex.target?.lo ?? 10;
      row.classList.toggle('set--done', s.done);
      b.setAttribute('aria-pressed', s.done);
      b.setAttribute('aria-label', s.done ? '완료 취소' : '세트 완료');
      save();
      if (s.done) startRest(s.warm ? 60 : ex.target?.rest || 90); else stopRest();
      return;
    }
    if (act === 'add-set') {
      const last = ex.sets.filter((x) => !x.warm).at(-1) || ex.sets.at(-1);
      ex.sets.push({ w: last?.w ?? null, r: last?.r ?? ex.target?.lo ?? 10, done: false, warm: false });
      save(); return paint();
    }
    if (act === 'same') {
      const h = historyOf(await all(), ex.exId)[0];
      if (!h) return notice('이 종목은 지난 기록이 없어요.');
      const work = h.sets.filter((x) => !x.warm && x.done);
      ex.sets = [...ex.sets.filter((x) => x.warm), ...work.map((x) => ({ w: x.w, r: x.r, done: false, warm: false }))];
      save(); return paint();
    }
    if (act === 'remove') {
      if (ex.sets.some((x) => x.done) && !(await confirmSheet('종목 빼기', `${byId[ex.exId].name}의 완료한 세트도 함께 지워져요.`, '빼기', true))) return;
      a.exercises.splice(k, 1); save(); return paint();
    }
    if (act === 'swap') return swapSheet(k);
    if (act === 'info') return exerciseInfo(ex.exId, await all());
    if (act === 'add-ex') return addSheet();
    if (act === 'add-cardio') return cardioSheet();
    if (act === 'del-cardio') { a.cardio.splice(Number(b.dataset.i), 1); save(); return paint(); }
    if (act === 'discard') {
      if (!(await confirmSheet('기록 취소', '이번 운동 기록을 저장하지 않고 지워요.', '지우기', true))) return;
      await db.del('kv', 'active'); stopRest(); keepAwake(false); return ctx.refresh();
    }
    if (act === 'finish') return finish();
  };

  function swapSheet(k) {
    const cur = a.exercises[k];
    const opts = swapOptions(cur.exId, ctx.profile);
    sheet({ title: `${byId[cur.exId].name} 대신`, wide: true,
      body: `<p class="sheet-text muted">같은 동작이 먼저, 같은 부위가 그다음이에요. 무게 기록은 종목마다 따로 쌓여요.</p>
        <ul class="rows">${opts.map((o) => `<li><button type="button" class="row" data-act="pick" data-id="${o.id}">${exThumb(o.id)}
        <span class="row-main"><span>${esc(o.name)}</span><span class="muted">${EQUIP[o.equip]}${o.hurts ? ', 아픈 부위에 부담' : ''}</span></span></button></li>`).join('')}</ul>`,
      actions: { pick: async (el, _, close) => {
        close();
        const id = el.dataset.id;
        const hist = historyOf(await all(), id);
        const target = cur.target || { sets: 3, lo: 8, hi: 12, rest: 90 };
        const sug = suggest({ ...target, exId: id }, hist);
        const doneWork = cur.sets.filter((x) => !x.warm);
        a.exercises[k] = { exId: id, target, sug, sets: [...warmups(id, sug.weight), ...doneWork.map((x) => ({ w: sug.weight, r: x.r, done: false, warm: false }))] };
        save(); paint();
      } } });
  }

  function addSheet() {
    let muscle = 'chest';
    const list = () => EXERCISES.filter((e) => e.muscle === muscle).map((e) => `<li><button type="button" class="row" data-act="pick" data-id="${e.id}">${exThumb(e.id)}
      <span class="row-main"><span>${esc(e.name)}</span><span class="muted">${EQUIP[e.equip]}</span></span>${icon('plus')}</button></li>`).join('');
    const s = sheet({ title: '종목 추가', wide: true,
      body: `<div class="chips" role="group" aria-label="부위">${Object.entries(MUSCLES).map(([k, v]) => `<button type="button" class="chip" data-act="m" data-m="${k}" aria-pressed="${k === muscle}">${v}</button>`).join('')}</div>
        <ul class="rows" id="add-list">${list()}</ul>`,
      actions: {
        m: (el) => { muscle = el.dataset.m; for (const c of s.body.querySelectorAll('.chip')) c.setAttribute('aria-pressed', c.dataset.m === muscle); s.body.querySelector('#add-list').innerHTML = list(); },
        pick: async (el, _, close) => {
          close();
          const id = el.dataset.id;
          const ex = byId[id];
          const target = ex.compound ? { sets: 3, lo: 8, hi: 12, rest: 120 } : { sets: 3, lo: 10, hi: 15, rest: 75 };
          const sug = suggest({ ...target, exId: id }, historyOf(await all(), id));
          a.exercises.push({ exId: id, target, sug, sets: [...warmups(id, sug.weight), ...Array.from({ length: 3 }, () => ({ w: sug.weight, r: target.lo, done: false, warm: false }))] });
          save(); paint();
          root.querySelector(`.ex[data-k="${a.exercises.length - 1}"]`)?.scrollIntoView({ block: 'start' });
        },
      } });
  }

  async function cardioSheet() {
    const weight = await currentWeight(ctx.profile);
    let type = 'treadmill';
    const kcalOf = (f) => {
      const c = CARDIO.find((x) => x.id === type);
      return kcalFromMet(c.met(num(f.speed?.value), num(f.incline?.value)), weight, num(f.min.value) || 0);
    };
    const fields = () => `${stepper({ name: 'min', value: a.cardioPlan || 20, step: 5, unit: '분', label: '시간' })}
      ${type === 'treadmill' ? `<div class="field"><span class="field-label">속도</span>${stepper({ name: 'speed', value: 6, step: 0.5, unit: 'km/h', label: '속도', decimal: true })}</div>
        <div class="field"><span class="field-label">경사</span>${stepper({ name: 'incline', value: 0, step: 1, unit: '%', label: '경사' })}</div>` : ''}`;
    const s = sheet({ title: '유산소 추가',
      body: `<div class="chips" role="group" aria-label="종류">${CARDIO.map((c) => `<button type="button" class="chip" data-act="t" data-t="${c.id}" aria-pressed="${c.id === type}">${c.name}</button>`).join('')}</div>
        <div id="cardio-fields">${fields()}</div>
        <p class="calc-line">약 <span class="measure" id="cardio-kcal">0</span>kcal</p>
        <button type="button" class="btn btn--primary btn--wide" data-act="save">추가</button>`,
      onInput: (_, f) => { s.body.querySelector('#cardio-kcal').textContent = kcalOf(f); },
      actions: {
        t: (el, f) => { type = el.dataset.t; for (const c of s.body.querySelectorAll('.chip')) c.setAttribute('aria-pressed', c.dataset.t === type); s.body.querySelector('#cardio-fields').innerHTML = fields(); s.body.querySelector('#cardio-kcal').textContent = kcalOf(f); },
        save: (_, f, close) => {
          const min = num(f.min.value);
          if (!min) return;
          a.cardio.push({ type, min, speed: num(f.speed?.value), incline: num(f.incline?.value), kcal: kcalOf(f) });
          close(); save(); paint();
        },
      } });
    s.body.querySelector('#cardio-kcal').textContent = kcalOf(s.form);
  }

  async function finish() {
    for (const e of a.exercises) e.sets = e.sets.filter((s) => s.done);
    a.exercises = a.exercises.filter((e) => e.sets.length);
    if (!a.exercises.length && !a.cardio.length) {
      if (await confirmSheet('완료한 세트가 없어요', '체크한 세트가 없어서 저장할 기록이 없어요. 운동을 닫을까요?', '닫기')) {
        await db.del('kv', 'active'); stopRest(); keepAwake(false); ctx.refresh();
      } else { const fresh = await db.kv('active'); Object.assign(a, fresh); paint(); }
      return;
    }
    const prev = await all();
    const weight = await currentWeight(ctx.profile);
    const w = {
      id: a.id, date: a.date, startedAt: a.startedAt, endedAt: Date.now(), name: a.name, planIdx: a.planIdx,
      minutes: Math.max(1, Math.round((Date.now() - a.startedAt) / 60000)),
      exercises: a.exercises.map((e) => ({ exId: e.exId, sets: e.sets.map(({ w: wt, r, warm }) => ({ w: wt, r, warm: !!warm, done: true })) })),
      cardio: a.cardio,
    };
    w.volume = Math.round(w.exercises.reduce((s, e) => s + e.sets.filter((x) => !x.warm).reduce((t, x) => t + (x.w || 0) * (x.r || 0), 0), 0));
    w.kcal = workoutKcal(w, weight);
    const prs = w.exercises.map((e) => {
      const best = bestSet(e.sets);
      const before = Math.max(0, ...historyOf(prev, e.exId).map((h) => bestSet(h.sets)?.e1rm || 0));
      return best && before && best.e1rm > before ? { name: byId[e.exId].name, best } : null;
    }).filter(Boolean);
    await db.put('workouts', w);
    if (a.planIdx != null) { const plan = await getPlan(); if (plan) { plan.next = a.planIdx + 1; await savePlan(plan); } }
    await db.del('kv', 'active');
    stopRest(); keepAwake(false);
    sheet({ title: '운동 끝', body: `<dl class="stats">
        <div><dt>시간</dt><dd class="measure">${w.minutes}<small>분</small></dd></div>
        <div><dt>총 볼륨</dt><dd class="measure">${fmt(w.volume)}<small>kg</small></dd></div>
        <div><dt>소모</dt><dd class="measure">${fmt(w.kcal)}<small>kcal</small></dd></div></dl>
        ${prs.length ? `<h3 class="sheet-sub">최고기록 갱신</h3><ul class="rows">${prs.map((x) => `<li class="row row--static"><span class="row-main"><span>${esc(x.name)}</span><span class="muted measure">${x.best.w}kg × ${x.best.r}</span></span><span class="row-side measure accent">${fmt(x.best.e1rm, 1)}kg</span></li>`).join('')}</ul>` : ''}
        <p class="fine">소모 칼로리는 오늘 식단 목표에 더해졌어요.</p>
        <button type="button" class="btn btn--primary btn--wide" data-act="close">확인</button>` });
    ctx.refresh();
  }

  paint();
}

// ---------------- 지난 운동 보기 ----------------
function openWorkout(w, ctx) {
  const s = sheet({ title: `${md(w.date)} ${w.name}`, wide: true,
    body: `<dl class="stats"><div><dt>시간</dt><dd class="measure">${w.minutes}<small>분</small></dd></div>
      <div><dt>볼륨</dt><dd class="measure">${fmt(w.volume)}<small>kg</small></dd></div>
      <div><dt>소모</dt><dd class="measure">${fmt(w.kcal)}<small>kcal</small></dd></div></dl>
      <ul class="rows">${w.exercises.map((e) => `<li class="row row--static"><span class="row-main"><span>${esc(byId[e.exId]?.name || e.exId)}</span>
        <span class="muted measure">${setsText(e.sets)}</span></span></li>`).join('')}
      ${(w.cardio || []).map((c) => `<li class="row row--static"><span class="row-main"><span>${esc(CARDIO.find((x) => x.id === c.type)?.name)}</span><span class="muted measure">${c.min}분</span></span><span class="row-side measure">${c.kcal}kcal</span></li>`).join('')}</ul>
      <div class="row-actions"><button type="button" class="btn btn--danger" data-act="del">이 기록 지우기</button></div>`,
    actions: { del: async (_, __, close) => {
      close();
      if (await confirmSheet('기록 지우기', '이 운동 기록을 지우면 되돌릴 수 없어요.', '지우기', true)) { await db.del('workouts', w.id); ctx.refresh(); }
    } } });
  return s;
}

// ---------------- 종목 정보: 자세 요점 + 성장 그래프 ----------------
export function exerciseInfo(exId, all) {
  const ex = byId[exId];
  const hist = historyOf(all, exId).reverse();
  const points = hist.map((h) => ({ date: h.date, y: bestSet(h.sets)?.e1rm })).filter((x) => x.y);
  const best = points.reduce((m, x) => (x.y > (m?.y || 0) ? x : m), null);
  const top = hist.flatMap((h) => h.sets.filter((s) => s.done && !s.warm)).reduce((m, s) => (!m || (s.w || 0) > (m.w || 0) ? s : m), null);
  sheet({ title: ex.name, wide: true,
    body: `${exAnim(ex.id, ex.name)}
      <p class="muted">${esc(ex.muscles)}, ${EQUIP[ex.equip]}</p>
      <ol class="tips">${ex.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      ${points.length ? `<dl class="stats"><div><dt>추정 1RM 최고</dt><dd class="measure">${fmt(best.y, 1)}<small>kg</small></dd></div>
        <div><dt>최고 무게</dt><dd class="measure">${top?.w ?? '-'}<small>kg × ${top?.r ?? ''}</small></dd></div>
        <div><dt>기록</dt><dd class="measure">${hist.length}<small>회</small></dd></div></dl>
        ${points.length > 1 ? lineChart({ points, label: '추정 1RM 변화', unit: 'kg' }) : ''}` : '<p class="empty">아직 이 종목 기록이 없어요.</p>'}
      <p class="fine">추정 1RM은 무게 × (1 + 반복수 ÷ 30)으로 계산해요 (Epley).</p>` });
}

export { e1rm };
