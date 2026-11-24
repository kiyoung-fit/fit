// 운동 플랜 설계와 오늘의 추천, 증량·디로드 판단
import { EXERCISES, byId } from './data/exercises.js';
import { today, daysBetween, parseYmd, ymd, round, e1rm } from './calc.js';

const T = {
  fullA: { name: '전신 A', slots: ['squat', 'hpush', 'vpull', 'hinge', 'side_delt', 'triceps', 'core'] },
  fullB: { name: '전신 B', slots: ['hinge', 'vpush', 'hpull', 'lunge', 'biceps', 'chest_iso', 'core'] },
  upperA: { name: '상체 A', slots: ['hpush', 'hpull', 'vpush', 'vpull', 'side_delt', 'triceps', 'biceps'] },
  lowerA: { name: '하체 A', slots: ['squat', 'hinge', 'quad_iso', 'ham_iso', 'lunge', 'calves', 'core'] },
  upperB: { name: '상체 B', slots: ['vpull', 'hpush', 'hpull', 'side_delt', 'chest_iso', 'biceps', 'triceps'] },
  lowerB: { name: '하체 B', slots: ['hinge', 'squat', 'ham_iso', 'quad_iso', 'glute_iso', 'calves', 'core'] },
  push: { name: '밀기 (가슴·어깨·삼두)', slots: ['hpush', 'vpush', 'hpush', 'side_delt', 'chest_iso', 'triceps', 'triceps'] },
  pull: { name: '당기기 (등·이두)', slots: ['vpull', 'hpull', 'hpull', 'rear_delt', 'back_iso', 'biceps', 'biceps'] },
  legs: { name: '하체', slots: ['squat', 'hinge', 'lunge', 'quad_iso', 'ham_iso', 'calves', 'core'] },
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

const COUNT_BY_TIME = { 45: 4, 60: 5, 75: 6, 90: 7 };

function score(ex, p, variant) {
  let s = 0;
  if (p.experience === 'beg') {
    if (!ex.beg) s -= 100;
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
  return { exId: ex.id, sets, lo, hi, rest: ex.compound ? sc.restC : sc.restI };
}

export function buildPlan(p) {
  const split = splitFor(p.days);
  const count = COUNT_BY_TIME[p.sessionMin] || 5;
  const seen = {};
  const sessions = split.keys.map((key) => {
    const variant = seen[key] = (seen[key] ?? -1) + 1;
    const used = new Set();
    const items = [];
    for (const slot of T[key].slots) {
      if (items.length >= count) break;
      const ex = pick(slot, p, used, variant);
      if (!ex) continue;
      used.add(ex.id);
      items.push(itemFor(ex, p));
    }
    return { key, name: T[key].name + (variant ? ' (2)' : ''), items, cardio: SCHEME[p.goal].cardio };
  });
  return { goal: p.goal, days: p.days, sessionMin: p.sessionMin, split: split.name, sessions, next: 0, createdAt: today(), deloadEvery: 6, skipDeloadWeek: null };
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

const working = (sets) => (sets || []).filter((s) => s.done && !s.warm && s.w != null && s.r > 0);

// history: 해당 종목이 들어간 과거 기록 [{date, sets}] (최신순)
export function suggest(item, history, deload = false) {
  const ex = byId[item.exId];
  const last = history[0];
  if (!last || !working(last.sets).length) {
    return { kind: 'new', weight: null, text: `처음 하는 종목이에요. ${item.hi}회를 겨우 채울 무게로 시작하세요.` };
  }
  const ws = working(last.sets);
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
    const hw = working(h.sets);
    if (!hw.length) break;
    const t = Math.max(...hw.map((s) => s.w));
    if (t >= top && hw.filter((s) => s.w === t).some((s) => s.r < item.lo)) fails++; else break;
  }
  if (fails >= 3 && step) {
    const w = round(top * 0.9, step);
    return { kind: 'down', weight: w, text: `${top}kg에서 3번 연속 막혔어요. ${w}kg으로 낮춰 다시 쌓아 올리세요.` };
  }
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
    const v = e1rm(s.w, s.r);
    if (!best || v > best.e1rm) best = { ...s, e1rm: v };
  }
  return best;
}

// 오늘 추천: 플랜 순서대로, 48시간 안에 쓴 부위와 겹치면 다른 세션
export function recommend(plan, workouts, on = today()) {
  if (!plan) return null;
  const n = plan.sessions.length;
  const recent = workouts.filter((w) => daysBetween(w.date, on) <= 1 && daysBetween(w.date, on) >= 0);
  const tired = new Set(recent.flatMap((w) => w.exercises.map((e) => byId[e.exId]?.muscle)).filter(Boolean));
  const weekStart = (() => { const d = parseYmd(on); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); })();
  const doneThisWeek = workouts.filter((w) => w.date >= weekStart && w.date <= on).length;
  const overlap = (s) => s.items.filter((it) => tired.has(byId[it.exId].muscle) && byId[it.exId].compound).length;
  let idx = plan.next % n;
  let note = '';
  if (overlap(plan.sessions[idx]) >= 2) {
    const alt = [...Array(n).keys()].map((k) => (idx + k) % n).find((k) => overlap(plan.sessions[k]) === 0);
    if (alt != null && alt !== idx) { note = `${plan.sessions[idx].name}는 어제 쓴 부위와 겹쳐서 ${plan.sessions[alt].name}를 먼저 추천해요.`; idx = alt; }
    else note = '어제 쓴 부위가 아직 회복 중이에요. 무게를 조금 낮추거나 쉬어도 됩니다.';
  }
  const trainedToday = workouts.some((w) => w.date === on);
  return { idx, session: plan.sessions[idx], note, doneThisWeek, target: plan.days, trainedToday, weekDone: doneThisWeek >= plan.days };
}
