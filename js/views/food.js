import * as db from '../db.js';
import { esc, icon, stepper, num, sheet, confirmSheet, notice } from '../ui.js';
import { today, addDays, parseYmd, fmt } from '../calc.js';
import { dailyTargets, mealsOn, sum } from '../store.js';
import { loadFoods, search, nutrient } from '../foods.js';

const SLOTS = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };
const label = (d) => { if (d === today()) return '오늘'; if (d === addDays(today(), -1)) return '어제'; const x = parseYmd(d); return `${x.getMonth() + 1}월 ${x.getDate()}일`; };
const snap = (f) => ({ name: f.name, brand: f.brand || '', kcal: f.kcal, p: f.p, c: f.c, f: f.f, serving: f.serving || 100, unit: f.unit || 'g' });

const bar = (name, v, target, unit) => {
  const pct = target ? Math.min(1, v / target) : 0;
  return `<div class="macro"><div class="macro-top"><span>${name}</span><span class="measure">${fmt(v)}<span class="muted"> / ${fmt(target)}${unit}</span></span></div>
    <div class="macro-track" aria-hidden="true"><div class="macro-fill${v > target * 1.1 ? ' macro-fill--over' : ''}" style="transform:scaleX(${pct})"></div></div></div>`;
};

export async function render(root, ctx) {
  const date = ctx.args[0] && /^\d{4}-\d{2}-\d{2}$/.test(ctx.args[0]) ? ctx.args[0] : today();
  const p = ctx.profile;
  const t = await dailyTargets(p, date);
  const meals = await mealsOn(date);
  const total = sum(meals);
  const left = t.budget - total.kcal;

  root.innerHTML = `
    <div class="datebar">
      <a class="icon-btn" href="#/food/${addDays(date, -1)}" aria-label="전날">${icon('left')}</a>
      <span class="datebar-label">${label(date)}</span>
      ${date < today() ? `<a class="icon-btn" href="#/food/${addDays(date, 1)}" aria-label="다음 날">${icon('right')}</a>` : '<span class="icon-btn" aria-hidden="true"></span>'}
    </div>

    <section class="block budget" aria-label="칼로리">
      <p class="budget-left"><span class="measure figure-l${left < 0 ? ' over' : ''}">${fmt(Math.abs(left))}</span><span class="unit">kcal ${left < 0 ? '초과' : '남음'}</span></p>
      <dl class="budget-row">
        <div><dt>목표</dt><dd class="measure">${fmt(t.kcal)}</dd></div>
        <div><dt>운동</dt><dd class="measure">+${fmt(t.exercise)}</dd></div>
        <div><dt>먹음</dt><dd class="measure">${fmt(total.kcal)}</dd></div>
      </dl>
      ${bar('단백질', total.p, t.protein, 'g')}${bar('탄수화물', total.c, t.carbs, 'g')}${bar('지방', total.f, t.fat, 'g')}
    </section>

    ${Object.entries(SLOTS).map(([slot, name]) => {
      const rows = meals.filter((m) => m.slot === slot);
      const st = sum(rows);
      return `<section class="block meal" aria-labelledby="m-${slot}">
        <div class="block-head"><h2 id="m-${slot}">${name}</h2><span class="measure muted">${fmt(st.kcal)}kcal</span></div>
        ${rows.length ? `<ul class="rows">${rows.map((m) => `<li><button type="button" class="row" data-act="edit" data-id="${m.id}">
          <span class="row-main"><span>${esc(m.name)}</span><span class="muted measure">${m.amount ? `${fmt(m.amount)}${m.unit}` : '직접 입력'}${m.brand ? `, ${esc(m.brand)}` : ''}</span></span>
          <span class="row-side measure">${fmt(m.kcal)}</span></button></li>`).join('')}</ul>` : ''}
        <div class="meal-actions">
          <button type="button" class="btn btn--small" data-act="add" data-slot="${slot}">${icon('plus')}추가</button>
          ${rows.length ? `<button type="button" class="btn btn--small btn--quiet" data-act="combo-save" data-slot="${slot}">조합으로 저장</button>`
            : `<button type="button" class="btn btn--small btn--quiet" data-act="copy" data-slot="${slot}">${icon('copy')}어제 ${name} 그대로</button>`}
        </div>
      </section>`;
    }).join('')}
    ${meals.length ? '' : '<div class="row-actions row-actions--plain"><button type="button" class="btn" data-act="copy-day">어제 먹은 것 전부 가져오기</button></div>'}
    <p class="fine">영양 정보 출처: 식품의약품안전처 식품영양성분 데이터베이스. 시판 제품·술은 제품 라벨 평균값.</p>`;

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'add') return searchSheet(b.dataset.slot);
    if (act === 'edit') return editSheet(meals.find((m) => m.id === b.dataset.id));
    if (act === 'copy' || act === 'copy-day') {
      const prev = (await mealsOn(addDays(date, -1))).filter((m) => act === 'copy-day' || m.slot === b.dataset.slot);
      if (!prev.length) return notice('어제 기록이 없어요.');
      for (const m of prev) await db.put('meals', { ...m, id: db.uid(), date, createdAt: Date.now() });
      return ctx.refresh();
    }
    if (act === 'combo-save') {
      const rows = meals.filter((m) => m.slot === b.dataset.slot);
      const s = sheet({ title: '조합으로 저장', body: `<label class="field"><span class="field-label">이름</span>
        <input type="text" name="name" value="${esc(SLOTS[b.dataset.slot])} 단골" maxlength="30" autocomplete="off"></label>
        <p class="muted">${rows.map((m) => esc(m.name)).join(', ')}</p>
        <button type="button" class="btn btn--primary btn--wide" data-act="save">저장</button>`,
        actions: { save: async (_, f, close) => {
          await db.put('combos', { id: db.uid(), name: f.name.value.trim() || '내 조합', items: rows.map(({ id, date: _d, slot, createdAt, ...rest }) => rest) });
          close(); notice('조합을 저장했어요. 추가할 때 맨 위에 나와요.');
        } } });
      s.form.name.select();
    }
  };

  async function addMeal(slot, food, amount) {
    const n = nutrient(food, amount);
    await db.put('meals', { id: db.uid(), date, slot, name: food.name, brand: food.brand || '', amount, unit: food.unit || 'g', ...n, per100: snap(food), createdAt: Date.now() });
  }

  async function searchSheet(slot) {
    const favs = await db.kv('favs', []);
    const combos = await db.all('combos');
    const recentMeals = (await db.range('meals', addDays(today(), -30), today())).sort((a, b) => b.createdAt - a.createdAt);
    const recent = [];
    for (const m of recentMeals) if (m.per100 && !recent.some((r) => r.name === m.name) && recent.length < 15) recent.push({ ...m.per100, lastAmount: m.amount });

    const item = (f, i, kind) => `<li><button type="button" class="row" data-act="pick" data-kind="${kind}" data-i="${i}">
      <span class="row-main"><span>${esc(f.name)}</span><span class="muted">${f.brand ? esc(f.brand) + ', ' : ''}<span class="measure">${fmt(f.serving)}${f.unit} ${fmt(f.kcal * f.serving / 100)}kcal</span></span></span></button></li>`;
    let results = [];
    const idle = () => `${combos.length ? `<h3 class="sheet-sub">자주 먹는 조합</h3><ul class="rows">${combos.map((c, i) => `<li><div class="row row--split">
        <button type="button" class="row-main row-btn" data-act="combo" data-i="${i}"><span>${esc(c.name)}</span><span class="muted">${c.items.map((x) => esc(x.name)).join(', ')}</span></button>
        <span class="row-side measure">${fmt(sum(c.items).kcal)}</span>
        <button type="button" class="icon-btn" data-act="combo-del" data-i="${i}" aria-label="${esc(c.name)} 조합 지우기">${icon('trash')}</button></div></li>`).join('')}</ul>` : ''}
      ${favs.length ? `<h3 class="sheet-sub">즐겨찾기</h3><ul class="rows">${favs.map((f, i) => item(f, i, 'fav')).join('')}</ul>` : ''}
      ${recent.length ? `<h3 class="sheet-sub">최근 먹은 것</h3><ul class="rows">${recent.map((f, i) => item(f, i, 'recent')).join('')}</ul>` : ''}
      ${!combos.length && !favs.length && !recent.length ? '<p class="empty">음식 이름으로 찾아보세요. 예: 닭가슴살, 현미밥, 아메리카노, 소주</p>' : ''}`;

    const s = sheet({ title: `${SLOTS[slot]}에 추가`, wide: true,
      body: `<div class="search"><label class="visually-hidden" for="q">음식 검색</label>
        <input id="q" name="q" type="search" placeholder="음식 이름 검색" autocomplete="off" enterkeyhint="search">
        <button type="button" class="btn btn--small" data-act="custom">직접 입력</button></div>
        <div id="results">${idle()}</div>`,
      onInput: async (el) => {
        if (el.name !== 'q') return;
        const q = el.value;
        const box = s.body.querySelector('#results');
        if (!q.trim()) { box.innerHTML = idle(); return; }
        let foods;
        try { foods = await loadFoods(); } catch (err) { box.innerHTML = `<p class="empty">${esc(err.message)} 인터넷 연결을 확인한 뒤 다시 열어주세요.</p>`; return; }
        if (el.value !== q) return;
        results = search(foods, q);
        box.innerHTML = results.length ? `<ul class="rows">${results.map((f, i) => item(f, i, 'res')).join('')}</ul>`
          : `<p class="empty">"${esc(q)}" 결과가 없어요. 더 짧게 검색하거나 직접 입력하세요.</p>`;
      },
      actions: {
        pick: (el, _, close) => {
          const src = { fav: favs, recent, res: results }[el.dataset.kind][el.dataset.i];
          close(); amountSheet(slot, src, src.lastAmount);
        },
        combo: async (el, _, close) => {
          for (const it of combos[el.dataset.i].items) await db.put('meals', { ...it, id: db.uid(), date, slot, createdAt: Date.now() });
          close(); ctx.refresh();
        },
        'combo-del': async (el, _, close) => { await db.del('combos', combos[el.dataset.i].id); close(); searchSheet(slot); },
        custom: (_, __, close) => { close(); customSheet(slot); },
      } });
    loadFoods().catch(() => {}); // 미리 불러오기
  }

  async function amountSheet(slot, food, preset) {
    const favs = await db.kv('favs', []);
    let fav = favs.some((f) => f.name === food.name && f.brand === food.brand);
    const serving = food.serving || 100;
    const step = food.unit === 'ml' ? 50 : serving >= 200 ? 10 : 5;
    const calc = (amt) => nutrient(food, amt || 0);
    const line = (n) => `<span class="measure figure">${fmt(n.kcal)}</span><span class="unit">kcal</span>
      <span class="muted measure">단백질 ${n.p}g, 탄수 ${n.c}g, 지방 ${n.f}g</span>`;
    const start = preset || serving;
    const s = sheet({ title: food.name,
      body: `${food.brand ? `<p class="muted">${esc(food.brand)}</p>` : ''}
        <div class="chips">${[[0.5, '반'], [1, '1회 제공량'], [1.5, '1.5배'], [2, '2배']].map(([k, l]) => `<button type="button" class="chip" data-act="x" data-k="${k}">${l} <span class="measure">${fmt(serving * k)}${food.unit}</span></button>`).join('')}</div>
        ${stepper({ name: 'amount', value: start, step, unit: food.unit, label: '양' })}
        <p class="calc-line" id="amt-n">${line(calc(start))}</p>
        <div class="row-actions">
          <button type="button" class="btn" data-act="fav" aria-pressed="${fav}">${icon('star')}${fav ? '즐겨찾기 됨' : '즐겨찾기'}</button>
          <button type="button" class="btn btn--primary btn--wide" data-act="add">추가</button></div>
        <p class="fine">값은 100${food.unit}당 ${fmt(food.kcal)}kcal 기준으로 계산해요.</p>`,
      onInput: (_, f) => { s.body.querySelector('#amt-n').innerHTML = line(calc(num(f.amount.value))); },
      actions: {
        x: (el, f) => { f.amount.value = Math.round(serving * Number(el.dataset.k)); f.amount.dispatchEvent(new Event('input', { bubbles: true })); },
        fav: async (el) => {
          const list = await db.kv('favs', []);
          fav = !fav;
          await db.setKv('favs', fav ? [snap(food), ...list].slice(0, 40) : list.filter((f) => !(f.name === food.name && f.brand === food.brand)));
          el.setAttribute('aria-pressed', fav);
          el.innerHTML = `${icon('star')}${fav ? '즐겨찾기 됨' : '즐겨찾기'}`;
        },
        add: async (_, f, close) => {
          const amt = num(f.amount.value);
          if (!amt) return;
          await addMeal(slot, food, amt); close(); ctx.refresh();
        },
      } });
  }

  function customSheet(slot) {
    const s = sheet({ title: '직접 입력',
      body: `<label class="field"><span class="field-label">음식 이름</span><input type="text" name="name" maxlength="40" autocomplete="off" required></label>
        <div class="field"><span class="field-label">칼로리</span>${stepper({ name: 'kcal', value: '', step: 10, unit: 'kcal', label: '칼로리' })}</div>
        <div class="field"><span class="field-label">단백질 (모르면 비워두기)</span>${stepper({ name: 'p', value: '', step: 1, unit: 'g', label: '단백질', decimal: true })}</div>
        <div class="field"><span class="field-label">탄수화물</span>${stepper({ name: 'c', value: '', step: 1, unit: 'g', label: '탄수화물', decimal: true })}</div>
        <div class="field"><span class="field-label">지방</span>${stepper({ name: 'f', value: '', step: 1, unit: 'g', label: '지방', decimal: true })}</div>
        <p class="field-error" role="alert"></p>
        <button type="button" class="btn btn--primary btn--wide" data-act="save">추가</button>`,
      actions: { save: async (_, f, close) => {
        const name = f.name.value.trim(), kcal = num(f.kcal.value);
        if (!name || kcal == null) { s.body.querySelector('.field-error').textContent = '이름과 칼로리는 꼭 넣어주세요.'; (name ? f.kcal : f.name).focus(); return; }
        await db.put('meals', { id: db.uid(), date, slot, name, brand: '', amount: null, unit: '', kcal: Math.round(kcal), p: num(f.p.value) || 0, c: num(f.c.value) || 0, f: num(f.f.value) || 0, per100: null, createdAt: Date.now() });
        close(); ctx.refresh();
      } } });
  }

  function editSheet(m) {
    const food = m.per100;
    const s = sheet({ title: m.name,
      body: food ? `${stepper({ name: 'amount', value: m.amount, step: food.unit === 'ml' ? 50 : 10, unit: m.unit, label: '양' })}
          <p class="calc-line"><span class="measure figure" id="e-k">${fmt(m.kcal)}</span><span class="unit">kcal</span></p>`
        : `<p class="calc-line"><span class="measure figure">${fmt(m.kcal)}</span><span class="unit">kcal</span></p>`,
      onInput: (_, f) => { if (food) s.body.querySelector('#e-k').textContent = fmt(nutrient(food, num(f.amount.value) || 0).kcal); },
      actions: {
        save: async (_, f, close) => { const amt = num(f.amount.value); if (!amt) return; await db.put('meals', { ...m, amount: amt, ...nutrient(food, amt) }); close(); ctx.refresh(); },
        del: async (_, __, close) => { await db.del('meals', m.id); close(); ctx.refresh(); },
      } });
    s.body.insertAdjacentHTML('beforeend', `<div class="row-actions"><button type="button" class="btn btn--danger" data-act="del">지우기</button>
      ${food ? '<button type="button" class="btn btn--primary btn--wide" data-act="save">저장</button>' : ''}</div>`);
  }
}

export { confirmSheet };
