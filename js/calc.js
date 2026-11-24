// 계산 모음: 칼로리, 매크로, 1RM, 추세. 화면 코드와 분리해 검산하기 쉽게 둔다.

export const GOALS = {
  cut: { name: '체중 감량', short: '감량' },
  bulk: { name: '근육 키우기', short: '근비대' },
  strength: { name: '힘 키우기', short: '근력' },
  health: { name: '체력·건강 유지', short: '유지' },
};

export const ACTIVITY = [
  { v: 1.2, name: '앉아서 일함', hint: '사무직, 하루 대부분 앉아 있음' },
  { v: 1.375, name: '가볍게 움직임', hint: '서서 일하거나 하루 7천 보 정도' },
  { v: 1.55, name: '많이 움직임', hint: '하루 종일 걷거나 서서 움직이는 일' },
  { v: 1.725, name: '몸 쓰는 일', hint: '현장·물류처럼 힘을 쓰는 일' },
];

export const EXPERIENCE = { beg: '처음이거나 1년 미만', int: '1~3년', adv: '3년 이상' };
export const INJURY = { back: '허리', shoulder: '어깨', knee: '무릎', wrist: '손목' };

// 날짜는 모두 폰 기준 현지 날짜 'YYYY-MM-DD'
export const today = () => ymd(new Date());
export function ymd(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
export function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }

export function age(birth, on = today()) {
  const b = parseYmd(birth), t = parseYmd(on);
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

// 기초대사량: 체지방률을 알면 Katch-McArdle(제지방량 기준), 모르면 Mifflin-St Jeor
export function bmr(p, weight) {
  if (p.bodyFat) {
    const lbm = weight * (1 - p.bodyFat / 100);
    return { value: Math.round(370 + 21.6 * lbm), method: 'katch' };
  }
  const base = 10 * weight + 6.25 * p.height - 5 * age(p.birth);
  return { value: Math.round(base + (p.sex === 'm' ? 5 : -161)), method: 'mifflin' };
}

const FLOOR = { m: 1500, f: 1200 };

// 하루 목표. adaptive가 있으면(실측 소모량) 공식 대신 사용
export function targets(p, weight, adaptive = null) {
  const b = bmr(p, weight);
  const formula = Math.round(b.value * p.activity);
  const tdee = adaptive?.use ? adaptive.base : formula;
  let delta = 0;
  if (p.goal === 'cut') delta = -Math.min(500, Math.max(300, Math.round(tdee * 0.2)));
  if (p.goal === 'bulk') delta = 250;
  if (p.goal === 'strength') delta = 150;
  let kcal = tdee + delta;
  const floored = kcal < FLOOR[p.sex];
  if (floored) kcal = FLOOR[p.sex];
  const proteinPerKg = { cut: 2.0, bulk: 1.8, strength: 1.8, health: 1.6 }[p.goal];
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr: b.value, method: b.method, tdee, formula, delta, kcal: Math.round(kcal), floored, protein, proteinPerKg, fat, carbs };
}

export const bmi = (weight, heightCm) => weight / (heightCm / 100) ** 2;

// 1RM 추정 (Epley). 1회면 그대로
export const e1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30));

// 근력운동 칼로리: MET × 체중 × 시간
export const kcalFromMet = (met, weight, minutes) => Math.round(met * weight * (minutes / 60));

export const round = (v, step = 2.5) => Math.round(v / step) * step;

// 최소제곱 기울기 (x는 일수)
export function slope(points) {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  return den ? num / den : 0;
}

// 체중 7일 이동평균 (기록이 있는 날만)
export function movingAvg(entries, days = 7) {
  return entries.map((e) => {
    const win = entries.filter((x) => daysBetween(x.date, e.date) >= 0 && daysBetween(x.date, e.date) < days);
    return { date: e.date, avg: win.reduce((s, x) => s + x.weight, 0) / win.length };
  });
}

// 실측 소모량: 최근 21일 섭취 평균 - (체중 변화 × 7700kcal/kg)
// 조건: 체중 기록 8일 이상(14일 이상 기간), 식단 기록 14일 이상
export function adaptiveTdee({ weights, intakeByDay, exerciseByDay, formula, end = today() }) {
  const start = addDays(end, -20);
  const w = weights.filter((x) => x.date >= start && x.date <= end);
  const loggedDays = Object.keys(intakeByDay).filter((d) => d >= start && d <= end && intakeByDay[d] > 0);
  const span = w.length ? daysBetween(w[0].date, w[w.length - 1].date) : 0;
  const progress = { weighDays: w.length, foodDays: loggedDays.length, span };
  if (w.length < 8 || span < 14 || loggedDays.length < 14) return { ready: false, progress };
  const avgIntake = loggedDays.reduce((s, d) => s + intakeByDay[d], 0) / loggedDays.length;
  const kgPerDay = slope(w.map((x) => ({ x: daysBetween(start, x.date), y: x.weight })));
  let measured = Math.round(avgIntake - kgPerDay * 7700);
  // 기록 누락 등으로 튀는 값을 막기 위해 공식값 ±25% 안으로
  measured = Math.min(Math.round(formula * 1.25), Math.max(Math.round(formula * 0.75), measured));
  const avgExercise = loggedDays.reduce((s, d) => s + (exerciseByDay[d] || 0), 0) / loggedDays.length;
  return { ready: true, progress, measured, avgIntake: Math.round(avgIntake), kgPerWeek: kgPerDay * 7, base: Math.round(measured - avgExercise) };
}

export const fmt = (n, d = 0) => (n == null || Number.isNaN(n) ? '-' : Number(n).toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: 0 }));
