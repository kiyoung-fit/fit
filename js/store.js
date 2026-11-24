// 화면들이 함께 쓰는 데이터 조회
import * as db from './db.js';
import { targets, adaptiveTdee, today, addDays, kcalFromMet } from './calc.js';
import { byId } from './data/exercises.js';
import { buildPlan, PLAN_RULES } from './planner.js';

export const getProfile = () => db.kv('profile');
export const saveProfile = (p) => db.setKv('profile', p);
// 플랜 규칙이 바뀌면 예전 플랜을 새 규칙으로 다시 짠다 (진행 순서와 디로드 주기는 이어받음)
export async function getPlan() {
  const plan = await db.kv('plan');
  if (!plan || (plan.rules || 1) >= PLAN_RULES) return plan;
  const profile = await getProfile();
  if (!profile) return plan;
  const next = { ...buildPlan(profile), next: plan.next, createdAt: plan.createdAt, skipDeloadWeek: plan.skipDeloadWeek };
  await db.setKv('plan', next);
  await db.setKv('planUpgraded', true);
  return next;
}
export const savePlan = (p) => db.setKv('plan', p);

export async function bodyLog() {
  const rows = await db.all('body');
  return rows.sort((a, b) => (a.date < b.date ? -1 : 1));
}
export async function weights() { return (await bodyLog()).filter((r) => r.weight); }

export async function currentWeight(p) {
  const w = await weights();
  return w.length ? w[w.length - 1].weight : p.weight;
}

export async function workouts() {
  const rows = await db.all('workouts');
  return rows.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

// 종목별 과거 기록 (최신순)
export function historyOf(all, exId, excludeId = null) {
  const out = [];
  for (const w of all) {
    if (w.id === excludeId) continue;
    const e = w.exercises.find((x) => x.exId === exId);
    if (e) out.push({ date: w.date, sets: e.sets, workoutId: w.id });
  }
  return out;
}

export function workoutKcal(w, weight) {
  const lift = w.exercises.reduce((s, e) => s + e.sets.filter((x) => x.done).length, 0);
  const liftMin = Math.min(lift * 2.5, w.minutes || lift * 2.5);
  const metAvg = w.exercises.length ? w.exercises.reduce((s, e) => s + (byId[e.exId]?.met || 5), 0) / w.exercises.length : 5;
  const cardio = (w.cardio || []).reduce((s, c) => s + (c.kcal || 0), 0);
  return kcalFromMet(metAvg, weight, liftMin) + cardio;
}

export async function exerciseKcalByDay(weight) {
  const out = {};
  for (const w of await db.all('workouts')) out[w.date] = (out[w.date] || 0) + workoutKcal(w, weight);
  return out;
}

export async function intakeByDay(from = '0000-00-00', to = '9999-99-99') {
  const out = {};
  for (const m of await db.range('meals', from, to)) out[m.date] = (out[m.date] || 0) + m.kcal;
  return out;
}

// 오늘의 목표 칼로리 (실측 보정 포함) + 오늘 운동으로 쓴 칼로리
export async function dailyTargets(p, date = today()) {
  const weight = await currentWeight(p);
  const formula = targets(p, weight).formula;
  const exByDay = await exerciseKcalByDay(weight);
  const adaptive = adaptiveTdee({ weights: await weights(), intakeByDay: await intakeByDay(addDays(date, -20), date), exerciseByDay: exByDay, formula, end: date });
  const use = adaptive.ready && p.autoAdjust !== false;
  const t = targets(p, weight, use ? { use: true, base: adaptive.base } : null);
  const exercise = exByDay[date] || 0;
  return { ...t, weight, adaptive, usingAdaptive: use, exercise, budget: t.kcal + exercise };
}

export async function mealsOn(date) {
  const rows = await db.onDate('meals', date);
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export const sum = (rows) => rows.reduce((s, m) => ({ kcal: s.kcal + m.kcal, p: s.p + m.p, c: s.c + m.c, f: s.f + m.f }), { kcal: 0, p: 0, c: 0, f: 0 });
