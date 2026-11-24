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

export async function importAll(data) {
  if (data?.app !== 'my-health') throw new Error('이 앱에서 만든 백업 파일이 아닙니다.');
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
