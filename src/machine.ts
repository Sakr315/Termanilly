// Deterministic virtual machine: isolated filesystem + one shell "flavor".
// Nothing here touches the real disk or runs real commands.
export type Flavor = 'bash' | 'ps' | 'cmd';
export type Node = { t: 'd'; c: Map<string, Node> } | { t: 'f'; data: string };
export type Code = 'ENOENT' | 'EEXIST' | 'ENOTDIR' | 'EISDIR' | 'EINVAL';
const dir = (): Node => ({ t: 'd', c: new Map() });
const clone = (n: Node): Node =>
  n.t === 'f' ? { ...n } : { t: 'd', c: new Map([...n.c].map(([k, v]) => [k, clone(v)])) };

export class Machine {
  root = dir();
  cwd: string[] = [];
  constructor(public flavor: Flavor) {
    const home = this.win ? ['C:', 'Users', 'user'] : ['home', 'user'];
    this.mkdir(this.fmt(home), true);
    this.cwd = home;
  }
  get win() { return this.flavor !== 'bash'; }
  fmt(s: string[] = this.cwd) {
    if (!this.win) return '/' + s.join('/');
    return s.length === 1 ? s[0] + '\\' : s.join('\\');
  }
  prompt() {
    const p = this.fmt();
    if (this.flavor === 'bash') return `user@terminally:${p === '/home/user' ? '~' : p}$`;
    return this.flavor === 'ps' ? `PS ${p}>` : `${p}>`;
  }
  /** Linux paths are case-sensitive and use "/"; Windows paths are not, and use "\" (or "/"). */
  resolve(p: string): string[] {
    let base = [...this.cwd], parts: string[];
    if (!this.win) {
      if (p === '~' || p.startsWith('~/')) p = '/home/user' + p.slice(1);
      parts = p.split('/');
      if (p.startsWith('/')) base = [];
    } else {
      p = p.replace(/\//g, '\\');
      parts = p.split('\\');
      if (/^[A-Za-z]:/.test(p)) { base = []; parts[0] = parts[0].toUpperCase(); if (parts[0].length > 2) parts = [parts[0].slice(0, 2), parts[0].slice(2), ...parts.slice(1)]; }
      else if (p.startsWith('\\')) base = [this.cwd[0]];
    }
    for (const x of parts) {
      if (x === '' || x === '.') continue;
      if (x === '..') { if (base.length > (this.win ? 1 : 0)) base.pop(); } else base.push(x);
    }
    return base;
  }
  keyOf(d: Node, name: string) {
    if (d.t !== 'd') return;
    if (!this.win) return d.c.has(name) ? name : undefined;
    return [...d.c.keys()].find(k => k.toLowerCase() === name.toLowerCase());
  }
  find(d: Node, name: string) { const k = this.keyOf(d, name); return k === undefined || d.t !== 'd' ? undefined : d.c.get(k); }
  lookup(s: string[]) { let n: Node | undefined = this.root; for (const x of s) { n = n && this.find(n, x); if (!n) return; } return n; }

  mkdir(p: string, parents = false, errIfExists = !parents): Code | null {
    const s = this.resolve(p); let d = this.root;
    for (let i = 0; i < s.length; i++) {
      const last = i === s.length - 1; let n = this.find(d, s[i]);
      if (!n) { if (!last && !parents) return 'ENOENT'; n = dir(); (d as any).c.set(s[i], n); }
      else if (n.t === 'f') return last ? 'EEXIST' : 'ENOTDIR';
      else if (last && errIfExists) return 'EEXIST';
      d = n;
    }
    return null;
  }
  write(p: string, data: string, append = false): Code | null {
    const s = this.resolve(p), par = this.lookup(s.slice(0, -1));
    if (!par || par.t !== 'd' || !s.length) return 'ENOENT';
    const cur = this.find(par, s.at(-1)!);
    if (cur?.t === 'd') return 'EISDIR';
    par.c.set(this.keyOf(par, s.at(-1)!) ?? s.at(-1)!, { t: 'f', data: (append && cur?.t === 'f' ? cur.data : '') + data });
    return null;
  }
  touch(p: string) { return this.lookup(this.resolve(p)) ? null : this.write(p, ''); }
  read(p: string): string | Code { const n = this.lookup(this.resolve(p)); return !n ? 'ENOENT' : n.t === 'd' ? 'EISDIR' : n.data; }
  remove(p: string, recursive: boolean): Code | null {
    const s = this.resolve(p), par = this.lookup(s.slice(0, -1)), n = par && s.length ? this.find(par, s.at(-1)!) : undefined;
    if (!par || par.t !== 'd' || !n) return 'ENOENT';
    if (n.t === 'd' && !recursive) return 'EISDIR';
    par.c.delete(this.keyOf(par, s.at(-1)!)!); return null;
  }
  copy(a: string, b: string, recursive: boolean, move = false): Code | null {
    const sa = this.resolve(a), src = this.lookup(sa);
    if (!src || !sa.length) return 'ENOENT';
    if (src.t === 'd' && !recursive && !move) return 'EISDIR';
    const sb = this.resolve(b), dn = this.lookup(sb);
    const target = dn?.t === 'd' ? [...sb, sa.at(-1)!] : sb;
    const same = (x: string[], y: string[]) => x.length <= y.length && x.every((v, i) => this.win ? v.toLowerCase() === y[i].toLowerCase() : v === y[i]);
    if (src.t === 'd' && same(sa, target) && target.length > sa.length) return 'EINVAL'; // a folder cannot go inside itself
    if (this.fmt(target).toLowerCase() === this.fmt(sa).toLowerCase() && this.win || this.fmt(target) === this.fmt(sa)) return null;
    const par = this.lookup(target.slice(0, -1));
    if (!par || par.t !== 'd') return 'ENOENT';
    par.c.set(target.at(-1)!, clone(src));
    return move ? this.remove(a, true) : null;
  }
  list(p: string): { name: string; dir: boolean }[] | Code {
    const n = this.lookup(this.resolve(p));
    if (!n) return 'ENOENT';
    if (n.t === 'f') return [{ name: p, dir: false }];
    return [...n.c].map(([name, v]) => ({ name, dir: v.t === 'd' })).sort((x, y) => x.name.localeCompare(y.name));
  }
  cd(p: string): Code | null {
    const s = this.resolve(p), n = this.lookup(s);
    if (!n) return 'ENOENT'; if (n.t === 'f') return 'ENOTDIR';
    // keep the real on-disk casing (matters on case-insensitive Windows paths)
    let d: Node = this.root; this.cwd = s.map(x => { const k = this.keyOf(d, x)!; d = this.find(d, x)!; return k; }); return null;
  }
}
