// 음식 검색. foods.json(식약처 DB 정리본)은 식단 화면을 처음 열 때 한 번만 불러온다.
let cache = null;
const SYN = { 계란: '달걀', 닭가슴: '닭고기 가슴', 쌀밥: '밥', 햇반: '즉석밥', 아아: '아메리카노', 프로틴: '프로틴', 쉐이크: '프로틴' };

export async function loadFoods() {
  if (cache) return cache;
  const res = await fetch('js/data/foods.json');
  if (!res.ok) throw new Error('음식 목록을 불러오지 못했습니다.');
  const data = await res.json();
  cache = data.f.map((r, i) => ({
    id: 'f' + i, name: r[0], brand: r[1], kcal: r[2], p: r[3], c: r[4], f: r[5], serving: r[6], unit: r[7], src: r[8],
    key: (r[0] + ' ' + r[1]).replace(/\s+/g, '').toLowerCase(),
  }));
  return cache;
}

const norm = (s) => s.replace(/\s+/g, '').toLowerCase();

export function search(foods, q, limit = 60) {
  const raw = q.trim();
  if (!raw) return [];
  const tokens = raw.split(/\s+/).map((t) => norm(SYN[t] || t));
  const whole = norm(raw);
  const hits = [];
  for (const f of foods) {
    if (!tokens.every((t) => f.key.includes(t))) continue;
    let s = 0;
    if (f.src === 2) s += 40; // 앱 기본값(시판 제품·술)
    if (f.src === 1) s += 15; // 원재료
    const n = norm(f.name);
    if (n === whole) s += 60;
    else if (n.startsWith(whole)) s += 30;
    if (!f.brand) s += 10;
    s -= n.length * 0.6;
    hits.push([s, f]);
  }
  hits.sort((a, b) => b[0] - a[0]);
  return hits.slice(0, limit).map((h) => h[1]);
}

export const nutrient = (food, amount) => {
  const k = amount / 100;
  return { kcal: Math.round(food.kcal * k), p: +(food.p * k).toFixed(1), c: +(food.c * k).toFixed(1), f: +(food.f * k).toFixed(1) };
};
