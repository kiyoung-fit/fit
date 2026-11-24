// 폰 안 저장소 (IndexedDB). 서버로 보내는 것은 없다.
const NAME = 'my-health';
const VERSION = 1;
// kv: 프로필·설정·플랜·진행 중 운동 / workouts: 운동 기록 / meals: 식사 기록
// body: 하루 1건 신체 기록(date가 키) / combos: 자주 먹는 조합
const STORES = { kv: { keyPath: 'key' }, workouts: { keyPath: 'id', date: true }, meals: { keyPath: 'id', date: true }, body: { keyPath: 'date' }, combos: { keyPath: 'id' } };

let dbp;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, o] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const s = db.createObjectStore(name, { keyPath: o.keyPath });
        if (o.date) s.createIndex('date', 'date');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const get = (store, key) => tx(store, 'readonly', (s) => s.get(key));
export const put = (store, value) => tx(store, 'readwrite', (s) => { s.put(value); return value; });
export const del = (store, key) => tx(store, 'readwrite', (s) => s.delete(key));
export const all = (store) => tx(store, 'readonly', (s) => s.getAll());

export function range(store, from, to) {
  const r = IDBKeyRange.bound(from, to);
  return tx(store, 'readonly', (s) => (store === 'body' ? s.getAll(r) : s.index('date').getAll(r)));
}
export const onDate = (store, date) => range(store, date, date);

export async function kv(key, fallback = null) { const v = await get('kv', key); return v ? v.value : fallback; }
export const setKv = (key, value) => put('kv', { key, value });

export async function exportAll() {
  const out = { app: 'my-health', version: VERSION, exportedAt: new Date().toISOString() };
  for (const name of Object.keys(STORES)) out[name] = await all(name);
  return out;
}

// 백업 파일 검사: 화면에 그대로 찍히는 식별자·날짜·숫자 칸에 엉뚱한 값(HTML 등)이 들어 있으면 거부
const ID_KEYS = new Set(['id', 'key', 'date', 'exId', 'slot', 'type', 'goal', 'from', 'until', 'sex', 'birth', 'experience', 'unit', 'kind', 'next', 'createdAt', 'lastBackup', 'skipDeloadWeek', 'muscle', 'pattern', 'equip']);
const ID_RE = /^[\w.:-]{0,40}$/;
const NUM_KEYS = new Set(['w', 'r', 'kcal', 'p', 'c', 'f', 'amount', 'min', 'speed', 'incline', 'volume', 'minutes', 'weight', 'bodyFat', 'bw',
  'waist', 'sleep', 'water', 'steps', 'height', 'targetWeight', 'activity', 'days', 'sessionMin', 'sets', 'lo', 'hi', 'rest', 'serving', 'startedAt', 'endedAt', 'planIdx', 'cardio', 'cardioPlan', 'deloadEvery', 'e1rm']);
function check(v, k = '') {
  if (Array.isArray(v)) return v.forEach((x) => check(x, k));
  if (v && typeof v === 'object') return Object.entries(v).forEach(([kk, x]) => check(x, kk));
  if (ID_KEYS.has(k) && v != null && !(typeof v === 'string' && ID_RE.test(v)) && typeof v !== 'number') throw new Error('백업 파일 내용이 올바르지 않아 불러오지 않았어요.');
  if (NUM_KEYS.has(k) && v != null && typeof v !== 'number' && !Array.isArray(v) && typeof v !== 'object') throw new Error('백업 파일 내용이 올바르지 않아 불러오지 않았어요.');
}

export async function importAll(data) {
  if (data?.app !== 'my-health') throw new Error('이 앱에서 만든 백업 파일이 아닙니다.');
  for (const name of Object.keys(STORES)) if (data[name] != null && !Array.isArray(data[name])) throw new Error('백업 파일 형식이 올바르지 않아요.');
  check(Object.fromEntries(Object.keys(STORES).map((n) => [n, data[n] || []])));
  // 내 운동 사진: 이미지 data URL만 허용
  for (const row of data.kv || []) {
    if (String(row.key).startsWith('exPhoto:') && !/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(row.value)) throw new Error('백업 파일 내용이 올바르지 않아 불러오지 않았어요.');
  }
  const db = await open();
  await new Promise((resolve, reject) => {
    const t = db.transaction(Object.keys(STORES), 'readwrite');
    for (const name of Object.keys(STORES)) {
      const s = t.objectStore(name);
      s.clear();
      for (const row of data[name] || []) s.put(row);
    }
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

export async function wipe() {
  const db = await open();
  await new Promise((resolve, reject) => {
    const t = db.transaction(Object.keys(STORES), 'readwrite');
    for (const name of Object.keys(STORES)) t.objectStore(name).clear();
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}
