// 운동 플랜 설계와 오늘의 추천, 증량·디로드 판단
import { EXERCISES, byId } from './data/exercises.js';
import { today, daysBetween, parseYmd, ymd, round, e1rm } from './calc.js';

// slots: 기본 순서, extra: 시간이 남을 때 더 넣는 동작 (같은 동작이면 다른 종목을 고름)
const T = {
  fullA: { name: '전신 A', slots: ['squat', 'hpush', 'vpull', 'hinge', 'side_delt', 'triceps', 'core'], extra: ['chest_iso', 'biceps', 'hpull', 'calves'] },
  fullB: { name: '전신 B', slots: ['hinge', 'vpush', 'hpull', 'lunge', 'biceps', 'chest_iso', 'core'], extra: ['hpush', 'triceps', 'vpull', 'quad_iso'] },
  upperA: { name: '상체 A', slots: ['hpush', 'hpull', 'vpush', 'vpull', 'side_delt', 'triceps', 'biceps'], extra: ['chest_iso', 'rear_delt', 'triceps', 'biceps'] },
  lowerA: { name: '하체 A', slots: ['squat', 'hinge', 'quad_iso', 'ham_iso', 'lunge', 'calves', 'core'], extra: ['glute_iso', 'core'] },
  upperB: { name: '상체 B', slots: ['vpull', 'hpush', 'hpull', 'side_delt', 'chest_iso', 'biceps', 'triceps'], extra: ['hpush', 'rear_delt', 'biceps', 'triceps'] },
  lowerB: { name: '하체 B', slots: ['hinge', 'squat', 'ham_iso', 'quad_iso', 'glute_iso', 'calves', 'core'], extra: ['lunge', 'glute_iso'] },
  push: { name: '밀기 (가슴·어깨·삼두)', slots: ['hpush', 'vpush', 'hpush', 'side_delt', 'chest_iso', 'triceps', 'triceps'], extra: ['dip', 'side_delt', 'chest_iso'] },
  pull: { name: '당기기 (등·이두)', slots: ['vpull', 'hpull', 'hpull', 'rear_delt', 'back_iso', 'biceps', 'biceps'], extra: ['vpull', 'rear_delt', 'biceps'] },
  legs: { name: '하체', slots: ['squat', 'hinge', 'lunge', 'quad_iso', 'ham_iso', 'calves', 'core'], extra: ['glute_iso', 'hinge', 'core'] },
};

export function splitFor(days) {
  if (days <= 3) return { name: days === 2 ? '주 2회 전신' : '주 3회 전신', keys: ['fullA', 'fullB'] };
  if (days === 4) return { name: '상체·하체 분할', keys: ['upperA', 'lowerA', 'upperB', 'lowerB'] };
  if (days === 5) return { name: '밀기·당기기·하체 + 상체·하체', keys: ['push', 'pull', 'legs', 'upperA', 'lowerA'] };
  return { name: '밀기·당기기·하체 ×2', keys: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] };
}

// 목적별 반복수·휴식(초)
const SCHEME = {
  strength: { c: [3, 6], i: [8, 12], restC: 180, restI: 90, setsC: 4, cardio: 0 },
  bulk: { c: [6, 10], i: [10, 15], restC: 120, restI: 75, setsC: 3, cardio: 0 },
  cut: { c: [8, 12], i: [12, 15], restC: 90, restI: 60, setsC: 3, cardio: 20 },
  health: { c: [10, 12], i: [12, 15], restC: 90, restI: 60, setsC: 3, cardio: 15 },
};

function score(ex, p, variant) {
  let s = 0;
  if ((p.favorites || []).includes(ex.id)) s += 100; // 별표한 운동은 가장 먼저
  if (p.experience === 'beg') {
    if (!ex.beg && !(p.favorites || []).includes(ex.id)) s -= 100;
    if (ex.equip === 'machine' || ex.equip === 'cable') s += 6;
    if (ex.equip === 'dumbbell') s += 4;
  } else {
    if (ex.equip === 'barbell') s += p.goal === 'strength' ? 10 : 5;
    if (ex.equip === 'dumbbell') s += 3;
  }
  if (ex.equip === 'body' && ex.pattern !== 'core') s -= 3;
  // B 세션은 같은 슬롯에서 다른 종목을 고르도록 순서를 섞는다
  s += variant ? ((ex.id.length * 7) % 5) : 0;
  return s;
}

const FALLBACK = { squat: ['lunge', 'quad_iso'], hinge: ['ham_iso', 'glute_iso'], lunge: ['quad_iso'], vpush: ['side_delt'], hpush: ['chest_iso'] };

export function pick(pattern, p, used, variant = 0) {
  const injuries = p.injuries || [];
  const tries = [pattern, ...(FALLBACK[pattern] || [])];
  for (const pat of tries) {
    const list = EXERCISES.filter((e) => e.pattern === pat && !used.has(e.id) && !e.avoid.some((a) => injuries.includes(a)))
      .sort((a, b) => score(b, p, variant) - score(a, p, variant));
    if (list.length) return list[0];
  }
  return null;
}

export function itemFor(ex, p) {
  const sc = SCHEME[p.goal];
  const [lo, hi] = ex.compound ? sc.c : sc.i;
  let sets = ex.compound ? sc.setsC : 3;
  if (p.experience === 'beg' && ex.compound) sets = 3;
  if (p.sessionMin <= 45 && !ex.compound) sets = 2;
  if (ex.id === 'plank') return { exId: ex.id, sets, lo: 30, hi: 60, rest: 60 }; // 플랭크는 초 단위
  if (ex.equip === 'body' && ex.compound && ex.pattern !== 'hpush') return { exId: ex.id, sets, lo: Math.min(lo, 5), hi: Math.min(hi, 10), rest: sc.restC }; // 턱걸이·딥스
  return { exId: ex.id, sets, lo, hi, rest: ex.compound ? sc.restC : sc.restI };
}

export const PLAN_RULES = 4;

// 부위 묶음과 주간 목표 세트 수 (부위당 주 10세트 이상이 근육 유지·성장에 유리하다는 연구 기준)
const GROUP = { chest: 'chest', back: 'back', shoulders: 'shoulders', quads: 'quads', hams: 'hinge', glutes: 'hinge', biceps: 'biceps', triceps: 'triceps' };
const ARMS = new Set(['biceps', 'triceps']);
export function weeklyTargets(goal) {
  const T = goal === 'bulk' ? 12 : 10, A = goal === 'bulk' ? 8 : 6;
  return { chest: T, back: T, quads: T, hinge: T, shoulders: T - 2, biceps: A, triceps: A };
}
export function weeklySets(plan) {
  const per = plan.days / plan.sessions.length, out = {};
  for (const s of plan.sessions) for (const it of s.items) {
    const g = GROUP[byId[it.exId].muscle];
    if (g) out[g] = (out[g] || 0) + it.sets * per;
  }
  return out;
}

function chooseItems(key, p, variant, budget, cardio) {
  const slots = [...T[key].slots, ...T[key].extra];
  // 우선순위: 큰 동작 3개 → 팔 운동 1개 → 다음 동작 → 팔 운동 1개 → 나머지. 팔 운동이 시간에 밀려 빠지지 않게
  const arms = [...new Set(slots.filter((x) => ARMS.has(x)))];
  const main = slots.filter((x) => !ARMS.has(x));
  const order = [...main.slice(0, 3), ...arms.slice(0, 1), ...main.slice(3, 4), ...arms.slice(1), ...main.slice(4), ...slots.filter((x) => ARMS.has(x)).slice(arms.length)];
  // 시간별 최대 종목 수: 짧을수록 종목을 줄이고 세트를 채운다
  const maxCount = budget <= 45 ? 5 : budget <= 60 ? 7 : budget <= 75 ? 8 : 9;
  const used = new Set(), items = [];
  // 팔 운동은 시간과 상관없이 반드시 넣는다 (60분 이상이면 이두·삼두 둘 다, 짧으면 하나)
  const mustArms = arms.slice(0, budget >= 60 ? 2 : 1);
  for (const slot of order) {
    const ex = pick(slot, p, used, variant);
    if (!ex || items.length >= maxCount) continue;
    const it = itemFor(ex, p);
    const isArm = ARMS.has(slot) && mustArms.includes(slot) && !items.some((x) => byId[x.exId].pattern === slot);
    if (!isArm && items.length >= 3 && minutes({ items: [...items, it, ...mustArms.filter((a) => !items.some((x) => byId[x.exId].pattern === a) && a !== slot).map(() => ({ sets: 2, rest: 60 }))], cardio }) > budget) continue;
    if (isArm) it.sets = Math.min(it.sets, 3);
    used.add(ex.id);
    items.push(it);
  }
  // 운동 순서: 큰 동작 먼저, 팔·작은 동작은 뒤로
  return items.sort((x, y) => byId[y.exId].compound - byId[x.exId].compound);
}

// 유산소 시간: 감량 20분·유지 15분이 기본이지만, 운동 시간이 짧으면 근력운동 시간을 먼저 확보
// 유산소는 근력 세션과 따로 기록한다 (규칙 3). 근력 세션 시간은 전부 근력운동에 쓴다
const cardioMin = () => 0;
export const CARDIO_PLAN = { cut: { times: 3, min: 30 }, health: { times: 3, min: 30 }, bulk: { times: 2, min: 20 }, strength: { times: 2, min: 20 } };

const WEEKLY_MAX = 20, SESSION_MAX = 10;
const setMin = (it) => (it.rest + 45) / 60;

export function buildPlan(p) {
  const split = splitFor(p.days);
  const seen = {};
  const sessions = split.keys.map((key) => {
    const variant = seen[key] = (seen[key] ?? -1) + 1;
    return { key, name: T[key].name + (variant ? ' (2)' : ''), items: chooseItems(key, p, variant, p.sessionMin, cardioMin(p)), cardio: cardioMin(p) };
  });
  const plan = { rules: PLAN_RULES, cardio: CARDIO_PLAN[p.goal], goal: p.goal, days: p.days, sessionMin: p.sessionMin, split: split.name, sessions, next: 0, createdAt: today(), deloadEvery: 6, skipDeloadWeek: null };
  const budget = p.sessionMin;
  const minSets = (it) => (byId[it.exId].compound ? 3 : 2);
  const cap = (it) => (byId[it.exId].compound ? 5 : 4);

  // 1) 정한 시간을 넘으면 세트를 덜고, 그래도 넘으면 뒤쪽 보조 종목을 뺀다 (팔 운동은 남김)
  for (const s of sessions) {
    let guard = 50;
    while (minutes(s) > budget + 2 && guard--) {
      const cand = s.items.filter((it) => it.sets > minSets(it)).sort((a, b) => b.sets - a.sets || byId[a.exId].compound - byId[b.exId].compound)[0];
      if (cand) { cand.sets--; continue; }
      // 빼는 순서: 팔이 아닌 보조 동작 → 같은 세션에 같은 부위가 겹치는 동작. 부위 하나뿐인 큰 동작은 남긴다
      const grp = (it) => GROUP[byId[it.exId].muscle] || byId[it.exId].muscle;
      const list = s.items.map((it, i) => ({ it, i })).reverse().filter(({ it }) => !ARMS.has(byId[it.exId].muscle));
      const drop = list.find(({ it }) => !byId[it.exId].compound)
        || list.find(({ it }) => s.items.filter((x) => grp(x) === grp(it)).length > 1);
      if (!drop) break;
      s.items.splice(drop.i, 1);
    }
  }
  // 2) 세트 채우기: ① 주간 최소 목표까지 ② 남은 시간 안에서 주간 상한(부위당 20세트)·세션당 한 부위 10세트까지
  const target = weeklyTargets(p.goal);
  const per = plan.days / sessions.length;
  const inSession = (s, g) => s.items.filter((x) => GROUP[byId[x.exId].muscle] === g).reduce((t, x) => t + x.sets, 0);
  for (const phase of [1, 2]) {
    for (let guard = 0; guard < 400; guard++) {
      const have = weeklySets(plan);
      const open = (g) => (phase === 1 ? (have[g] || 0) < target[g] : (have[g] || 0) + per <= WEEKLY_MAX + 0.01);
      const groups = Object.keys(target).filter(open).sort((a, b) => (have[a] || 0) / target[a] - (have[b] || 0) / target[b]);
      let added = false;
      for (const g of groups) {
        const cands = sessions.flatMap((s) => s.items.filter((it) => GROUP[byId[it.exId].muscle] === g && it.sets < cap(it)
            && inSession(s, g) < SESSION_MAX && minutes(s) + setMin(it) <= budget).map((it) => ({ s, it })))
          .sort((a, b) => a.it.sets - b.it.sets || minutes(a.s) - minutes(b.s));
        if (cands.length) { cands[0].it.sets++; added = true; break; }
      }
      if (!added) break;
    }
  }
  // ③ 그래도 시간이 남으면 부위 집계에 없는 종목(종아리·코어 등) 세트를 더한다
  for (const s of sessions) {
    for (let guard = 0; guard < 30; guard++) {
      const it = s.items.filter((x) => !GROUP[byId[x.exId].muscle] && x.sets < cap(x) && minutes(s) + setMin(x) <= budget).sort((a, b) => a.sets - b.sets)[0];
      if (!it) break;
      it.sets++;
    }
  }
  return plan;
}

export function swapOptions(exId, p) {
  const ex = byId[exId];
  const injuries = p.injuries || [];
  return EXERCISES.filter((e) => e.id !== exId && (e.pattern === ex.pattern || e.muscle === ex.muscle))
    .map((e) => ({ ...e, hurts: e.avoid.some((a) => injuries.includes(a)) }))
    .sort((a, b) => (a.pattern === ex.pattern ? 0 : 1) - (b.pattern === ex.pattern ? 0 : 1) || a.hurts - b.hurts);
}

export function minutes(session) {
  const sec = session.items.reduce((s, it) => s + it.sets * (it.rest + 45), 0) + 5 * 60;
  return Math.round(sec / 60) + (session.cardio || 0);
}

// 이번 주가 디로드 주인지: 플랜 시작 후 6주마다 1주
export function deloadState(plan, on = today()) {
  const week = Math.floor(daysBetween(plan.createdAt, on) / 7);
  const isDeload = (week + 1) % plan.deloadEvery === 0 && plan.skipDeloadWeek !== week;
  return { week, isDeload, weeksLeft: plan.deloadEvery - 1 - (week % plan.deloadEvery) };
}

// 맨몸 종목은 w가 '추가 무게'(없으면 0), bw는 그날 체중. 볼륨·1RM은 체중+추가 무게로 계산
export const load = (s) => (s.w || 0) + (s.bw || 0);
const working = (sets) => (sets || []).filter((s) => s.done && !s.warm && s.r > 0 && (s.w != null || s.bw));

// history: 해당 종목이 들어간 과거 기록 [{date, sets}] (최신순)
export function suggest(item, history, deload = false) {
  const ex = byId[item.exId];
  const last = history[0];
  if (!last || !working(last.sets).length) {
    if (ex?.equip === 'body' && ex.inc) return { kind: 'new', weight: 0, text: `처음 기록하는 종목이에요. 맨몸으로 시작하고, ${item.hi}회가 쉬워지면 추가 무게를 다세요.` };
    return { kind: 'new', weight: null, text: `처음 하는 종목이에요. ${item.hi}회를 겨우 채울 무게로 시작하세요.` };
  }
  const ws = working(last.sets).map((s) => ({ ...s, w: s.w || 0 }));
  const body = ex.equip === 'body';
  const top = Math.max(...ws.map((s) => s.w));
  const atTop = ws.filter((s) => s.w === top);
  const step = ex.inc || 0;
  if (deload) {
    const w = step ? round(top * 0.9, step) : top;
    return { kind: 'deload', weight: w, text: `가볍게 가는 주예요. ${w}kg으로 세트를 하나 줄여서 하세요.` };
  }
  // 3회 연속 목표 최소 반복수를 못 채웠는지
  let fails = 0;
  for (const h of history.slice(0, 3)) {
    const hw = working(h.sets).map((s) => ({ ...s, w: s.w || 0 }));
    if (!hw.length) break;
    const t = Math.max(...hw.map((s) => s.w));
    if (t >= top && hw.filter((s) => s.w === t).some((s) => s.r < item.lo)) fails++; else break;
  }
  if (fails >= 3 && step) {
    const w = round(top * 0.9, step);
    return { kind: 'down', weight: w, text: `${top}kg에서 3번 연속 막혔어요. ${w}kg으로 낮춰 다시 쌓아 올리세요.` };
  }
  if (body && atTop.length >= Math.min(item.sets, ws.length) && atTop.every((s) => s.r >= item.hi)) {
    if (!step) return { kind: 'up', weight: top, text: `지난번 모든 세트 ${item.hi}회 성공. 조금 더 늘리거나 천천히 해보세요.` };
    return { kind: 'up', weight: top + step, text: `지난번 모든 세트 ${item.hi}회 성공. 추가 무게 ${top + step}kg으로 하거나, 같은 무게로 1회씩 더 해보세요.` };
  }
  if (body) return { kind: 'same', weight: top, text: top ? `추가 무게 ${top}kg 유지. 세트마다 1회씩 더 해보세요.` : '맨몸으로 세트마다 1회씩 더 해보세요. 목표 횟수를 다 채우면 추가 무게를 제안해요.' };
  if (atTop.length >= Math.min(item.sets, ws.length) && atTop.every((s) => s.r >= item.hi)) {
    if (!step) return { kind: 'up', weight: top, text: `지난번 모든 세트 ${item.hi}회 성공. 반복수를 늘리거나 느리게 해보세요.` };
    const w = top + step;
    return { kind: 'up', weight: w, text: `지난번 모든 세트 ${item.hi}회 성공. ${w}kg으로 올리세요.` };
  }
  return { kind: 'same', weight: top, text: `${top}kg 유지. 세트마다 1회씩 더 해보세요.` };
}

export function warmups(exId, weight) {
  const ex = byId[exId];
  if (!ex?.compound || !weight || weight < 30 || ex.equip === 'body') return [];
  const step = ex.equip === 'barbell' ? 2.5 : ex.inc || 2.5;
  const out = [];
  if (ex.equip === 'barbell' && weight > 40) out.push({ w: 20, r: 10 });
  for (const [pct, r] of [[0.5, 5], [0.7, 3], ...(weight >= 80 ? [[0.85, 1]] : [])]) {
    const w = round(weight * pct, step);
    if (w > (out.at(-1)?.w || 0) && w < weight) out.push({ w, r });
  }
  return out.map((s) => ({ ...s, warm: true, done: false }));
}

export function bestSet(sets) {
  let best = null;
  for (const s of working(sets)) {
    const v = e1rm(load(s), s.r);
    if (!best || v > best.e1rm) best = { ...s, e1rm: v };
  }
  return best;
}

export const weekStartOf = (on = today()) => { const d = parseYmd(on); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
export const groupOf = (exId) => GROUP[byId[exId]?.muscle] || null;
export function setsByGroup(exercises) {
  const out = {};
  for (const e of exercises) {
    const g = groupOf(e.exId);
    if (g) out[g] = (out[g] || 0) + e.sets.filter((x) => x.done && !x.warm).length;
  }
  return out;
}
export function weeklyDone(workouts, on = today()) {
  const start = weekStartOf(on);
  return setsByGroup(workouts.filter((w) => w.date >= start && w.date <= on).flatMap((w) => w.exercises));
}
export const GROUP_NAMES = { chest: '가슴', back: '등', shoulders: '어깨', quads: '허벅지 앞', hinge: '엉덩이·허벅지 뒤', biceps: '이두', triceps: '삼두' };

// 오늘 추천: 플랜 순서대로, 48시간 안에 쓴 부위와 겹치면 다른 세션
export function recommend(plan, workouts, on = today()) {
  if (!plan) return null;
  const n = plan.sessions.length;
  const lifts = workouts.filter((w) => w.exercises.length);
  const recent = lifts.filter((w) => daysBetween(w.date, on) <= 1 && daysBetween(w.date, on) >= 0);
  const tired = new Set(recent.flatMap((w) => w.exercises.map((e) => byId[e.exId]?.muscle)).filter(Boolean));
  const weekStart = (() => { const d = parseYmd(on); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); })();
  const doneThisWeek = lifts.filter((w) => w.date >= weekStart && w.date <= on).length;
  const cardioThisWeek = workouts.filter((w) => w.date >= weekStart && w.date <= on && (w.cardio || []).length);
  const cardio = { done: cardioThisWeek.length, minutes: cardioThisWeek.reduce((t, w) => t + w.cardio.reduce((u, c) => u + c.min, 0), 0), target: plan.cardio || CARDIO_PLAN[plan.goal] };
  const overlap = (s) => s.items.filter((it) => tired.has(byId[it.exId].muscle) && byId[it.exId].compound).length;
  let idx = plan.next % n;
  let note = '';
  if (overlap(plan.sessions[idx]) >= 2) {
    const alt = [...Array(n).keys()].map((k) => (idx + k) % n).find((k) => overlap(plan.sessions[k]) === 0);
    if (alt != null && alt !== idx) { note = `${plan.sessions[idx].name}는 어제 쓴 부위와 겹쳐서 ${plan.sessions[alt].name}를 먼저 추천해요.`; idx = alt; }
    else note = '어제 쓴 부위가 아직 회복 중이에요. 무게를 조금 낮추거나 쉬어도 됩니다.';
  }
  const trainedToday = lifts.some((w) => w.date === on);
  return { idx, session: plan.sessions[idx], note, doneThisWeek, cardio, target: plan.days, trainedToday, weekDone: doneThisWeek >= plan.days };
}
