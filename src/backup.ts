// Validated import/export of settings + progress. Imported text is untrusted: whitelist, clamp, rebuild.
export const THEME_IDS = ['paper', 'midnight', 'matcha', 'rose', 'mocha', 'ocean'];
export const defS = { theme: 'paper', fontSize: 16, termSize: 13, reduceMotion: false, showWin: true, collapsed: false };
export const defP = { lessons: [] as string[], challenges: [] as string[], commands: {} as Record<string, number>, bookmarks: [] as string[], minutes: 0 };
export type S = typeof defS; export type P = typeof defP;
const strs = (x: unknown): string[] | null => Array.isArray(x) && x.length <= 1000 && x.every(s => typeof s === 'string' && s.length < 100) ? [...new Set(x as string[])] : null;
const int = (x: unknown, lo: number, hi: number) => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;
export const makeBackup = (s: S, p: P) => JSON.stringify({ app: 'terminally', version: 1, settings: s, progress: p }, null, 2);
export function parseBackup(text: string): { settings: S; progress: P } | { error: string } {
  let j: any; if (text.length > 1_000_000) return { error: 'File is too large.' };
  try { j = JSON.parse(text); } catch { return { error: 'That is not valid JSON.' }; }
  if (!j || j.app !== 'terminally') return { error: 'This is not a terminally backup.' };
  if (j.version !== 1) return { error: `Unsupported backup version ${String(j.version)}.` };
  const a = j.settings, b = j.progress;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return { error: 'Backup is missing settings or progress.' };
  if (!THEME_IDS.includes(a.theme)) return { error: 'Unknown theme in backup.' };
  if (!int(a.fontSize, 12, 24) || !int(a.termSize, 10, 24)) return { error: 'Font sizes in backup are out of range.' };
  if (![a.reduceMotion, a.showWin, a.collapsed].every(v => typeof v === 'boolean')) return { error: 'Settings in backup have the wrong types.' };
  const lessons = strs(b.lessons), challenges = strs(b.challenges), bookmarks = strs(b.bookmarks);
  if (!lessons || !challenges || !bookmarks) return { error: 'Progress lists in backup are invalid.' };
  if (!b.commands || typeof b.commands !== 'object' || Array.isArray(b.commands) || Object.keys(b.commands).length > 500) return { error: 'Command history in backup is invalid.' };
  const commands: Record<string, number> = {};
  for (const [k, v] of Object.entries(b.commands)) {
    if (k.length > 40 || ['__proto__', 'constructor', 'prototype'].includes(k) || !int(v, 0, 1_000_000)) return { error: 'Command history in backup is invalid.' };
    commands[k] = v as number;
  }
  if (typeof b.minutes !== 'number' || !Number.isFinite(b.minutes) || b.minutes < 0 || b.minutes > 1e7) return { error: 'Minutes in backup is invalid.' };
  return { settings: { theme: a.theme, fontSize: a.fontSize, termSize: a.termSize, reduceMotion: a.reduceMotion, showWin: a.showWin, collapsed: a.collapsed }, progress: { lessons, challenges, bookmarks, commands, minutes: Math.floor(b.minutes) } };
}
