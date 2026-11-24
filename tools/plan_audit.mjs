// 플랜 점검: 목적·일수·시간 조합별 부위당 주간 세트 수와 예상 시간. 실행: node tools/plan_audit.mjs
import { buildPlan, minutes } from '../js/planner.js';
import { byId } from '../js/data/exercises.js';
const G = { chest: '가슴', back: '등', shoulders: '어깨', quads: '대퇴', hams: '햄스', glutes: '둔근', biceps: '이두', triceps: '삼두' };
for (const goal of ['bulk', 'cut', 'strength']) for (const days of [3, 4, 5]) for (const sessionMin of [45, 60, 90]) {
  const p = { goal, days, sessionMin, experience: 'int', injuries: [] };
  const plan = buildPlan(p);
  const n = plan.sessions.length, perWeek = days / n; // 주당 세션 반복 비율
  const sets = {};
  for (const s of plan.sessions) for (const it of s.items) { const m = byId[it.exId].muscle; sets[m] = (sets[m] || 0) + it.sets * perWeek; }
  const mins = plan.sessions.map(minutes);
  console.log(`${goal} ${days}일 ${sessionMin}분 | ` + Object.entries(G).map(([k, v]) => `${v}${Math.round(sets[k] || 0)}`).join(' ') + ` | 시간 ${Math.min(...mins)}-${Math.max(...mins)}분`);
}
