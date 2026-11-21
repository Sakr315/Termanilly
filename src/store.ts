// SQLite (tauri-plugin-sql) inside the desktop app; localStorage fallback only for plain-browser dev.
import Database from '@tauri-apps/plugin-sql';
let db: Database | null = null;
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export async function initStore() {
  if (!inTauri) return;
  try { db = await Database.load('sqlite:terminally.db'); await db.execute('CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT NOT NULL)'); } catch { db = null; }
}
export async function load<T>(key: string, def: T): Promise<T> {
  try {
    if (db) { const r = await db.select<{ value: string }[]>('SELECT value FROM kv WHERE key=$1', [key]); return r.length ? { ...def, ...JSON.parse(r[0].value) } : def; }
    const v = localStorage.getItem('terminally:' + key); return v ? { ...def, ...JSON.parse(v) } : def;
  } catch { return def; }
}
export async function save(key: string, val: unknown): Promise<boolean> {
  const s = JSON.stringify(val);
  try { if (db) { await db.execute('INSERT INTO kv(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, s]); return true; } localStorage.setItem('terminally:' + key, s); return true; } catch { return false; }
}
