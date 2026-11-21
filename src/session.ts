// Save/restore the virtual machine. Imported sessions are untrusted: every name and size is validated.
import { Machine, Node, Flavor } from './machine';
import { validName } from './translate';
const MAX_NODES = 5000, MAX_DEPTH = 40, MAX_FILE = 200_000;
const ser = (n: Node): unknown => n.t === 'f' ? { f: n.data } : { d: Object.fromEntries([...n.c].map(([k, v]) => [k, ser(v)])) };
export const exportSession = (m: Machine) => JSON.stringify({ app: 'terminally-session', version: 1, flavor: m.flavor, cwd: m.cwd, tree: ser(m.root) });
export function importSession(text: string): { m: Machine } | { error: string } {
  if (text.length > 2_000_000) return { error: 'Session is too large.' };
  let j: any; try { j = JSON.parse(text); } catch { return { error: 'That is not valid JSON.' }; }
  if (!j || j.app !== 'terminally-session') return { error: 'This is not a terminally session.' };
  if (j.version !== 1) return { error: 'Unsupported session version.' };
  if (!['bash', 'ps', 'cmd'].includes(j.flavor)) return { error: 'Unknown shell in session.' };
  const fl = j.flavor as Flavor; let count = 0, bad: string | null = null;
  const build = (x: any, depth: number): Node | null => {
    if (bad) return null;
    if (++count > MAX_NODES) { bad = 'Session has too many items.'; return null; }
    if (depth > MAX_DEPTH) { bad = 'Folders are nested too deeply.'; return null; }
    if (x && typeof x === 'object' && typeof x.f === 'string' && x.d === undefined) { if (x.f.length > MAX_FILE) { bad = 'A file is too large.'; return null; } return { t: 'f', data: x.f }; }
    if (x && typeof x === 'object' && x.d && typeof x.d === 'object' && !Array.isArray(x.d)) {
      const c = new Map<string, Node>(), seen = new Set<string>();
      for (const [k, v] of Object.entries(x.d)) {
        const lk = fl === 'bash' ? k : k.toLowerCase();
        if (depth === 0 && fl !== 'bash') { if (!/^[A-Za-z]:$/.test(k)) { bad = 'Invalid drive name.'; return null; } }
        else if (validName(fl, k)) { bad = `Invalid name “${k.slice(0, 30)}” in session.`; return null; }
        if (seen.has(lk)) { bad = 'Duplicate names in a folder.'; return null; }
        seen.add(lk); const n = build(v, depth + 1); if (!n) return null; c.set(k, n);
      }
      return { t: 'd', c };
    }
    bad = 'Malformed filesystem tree.'; return null;
  };
  const root = build(j.tree, 0); if (!root) return { error: bad ?? 'Malformed filesystem tree.' };
  if (!Array.isArray(j.cwd) || j.cwd.length > MAX_DEPTH || !j.cwd.every((s: unknown) => typeof s === 'string')) return { error: 'Invalid current folder.' };
  const m = new Machine(fl); m.root = root; m.cwd = [...j.cwd];
  if (m.lookup(m.cwd)?.t !== 'd') return { error: 'Current folder does not exist in the session.' };
  return { m };
}
