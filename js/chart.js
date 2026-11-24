// 가벼운 SVG 선 그래프. 점(실제 기록) + 선(추세) + 세로 표시(목적 변경)
import { parseYmd, daysBetween } from './calc.js';
import { esc } from './ui.js';

export function lineChart({ points, line = null, markers = [], label, unit = '', height = 180, width = 340 }) {
  if (!points.length) return '';
  const pad = { l: 36, r: 8, t: 10, b: 22 };
  const first = points[0].date, last = points[points.length - 1].date;
  const span = Math.max(1, daysBetween(first, last));
  const ys = [...points.map((p) => p.y), ...(line || []).map((p) => p.y)];
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const padY = Math.max(0.5, (hi - lo) * 0.15);
  lo -= padY; hi += padY;
  const X = (d) => pad.l + (daysBetween(first, d) / span) * (width - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b);
  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15];
  const md = (d) => { const x = parseYmd(d); return `${x.getMonth() + 1}/${x.getDate()}`; };
  const path = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  return `<figure class="chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">
    ${ticks.map((t) => `<line class="chart-grid" x1="${pad.l}" x2="${width - pad.r}" y1="${Y(t)}" y2="${Y(t)}"/>
      <text class="chart-axis" x="${pad.l - 6}" y="${Y(t) + 4}" text-anchor="end">${t.toFixed(hi - lo < 6 ? 1 : 0)}</text>`).join('')}
    ${markers.filter((m) => m.date >= first && m.date <= last).map((m) => `<line class="chart-marker" x1="${X(m.date)}" x2="${X(m.date)}" y1="${pad.t}" y2="${height - pad.b}"/>
      <text class="chart-marker-label" x="${X(m.date) + 4}" y="${pad.t + 10}">${esc(m.label)}</text>`).join('')}
    ${points.map((p) => `<circle class="chart-dot${line ? ' chart-dot--quiet' : ''}" cx="${X(p.date).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${line ? 2.5 : 3.5}"/>`).join('')}
    ${line && line.length > 1 ? `<path class="chart-line" d="${path(line)}"/>` : !line && points.length > 1 ? `<path class="chart-line" d="${path(points)}"/>` : ''}
    <text class="chart-axis" x="${pad.l}" y="${height - 4}">${md(first)}</text>
    <text class="chart-axis" x="${width - pad.r}" y="${height - 4}" text-anchor="end">${md(last)}</text>
  </svg>${unit ? `<figcaption class="chart-cap">${esc(label)}, 단위 ${esc(unit)}</figcaption>` : ''}</figure>`;
}

export function sparkline(values, width = 120, height = 32) {
  if (values.length < 2) return '';
  const lo = Math.min(...values), hi = Math.max(...values);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1)) * width},${hi === lo ? height / 2 : (1 - (v - lo) / (hi - lo)) * (height - 4) + 2}`).join('');
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="${d}"/></svg>`;
}
