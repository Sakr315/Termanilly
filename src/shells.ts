import { Machine, Flavor, Code } from './machine';
export interface Result { out: string; err: string; clear?: boolean }
type Tok = { v: string; q: boolean };

// Each shell has its own tokenizer rules (bash/PS: ' and "; CMD: only ").
function tokenize(line: string, fl: Flavor): Tok[] {
  const toks: Tok[] = []; let cur = '', q = false, quote = '', has = false;
  const quotes = fl === 'cmd' ? '"' : '"\'';
  const push = () => { if (has) toks.push({ v: cur, q }); cur = ''; q = false; has = false; };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) { if (ch === quote) quote = ''; else cur += ch; }
    else if (quotes.includes(ch)) { quote = ch; q = true; has = true; }
    else if (/\s/.test(ch)) push();
    else if (ch === '>') { push(); const app = line[i + 1] === '>'; if (app) i++; toks.push({ v: app ? '>>' : '>', q: false }); }
    else { cur += ch; has = true; }
  }
  if (quote) throw new Error(fl === 'bash' ? "unexpected EOF while looking for matching quote" : 'The string is missing the terminator: ".');
  push(); return toks;
}

const ALIAS: Record<Flavor, Record<string, string>> = {
  bash: { pwd: 'pwd', cd: 'cd', ls: 'ls', mkdir: 'mkdir', touch: 'touch', cat: 'cat', rm: 'rm', cp: 'cp', mv: 'mv', echo: 'echo', clear: 'clear' },
  ps: { 'get-location': 'pwd', pwd: 'pwd', 'set-location': 'cd', cd: 'cd', sl: 'cd', 'get-childitem': 'ls', ls: 'ls', dir: 'ls', gci: 'ls',
    'new-item': 'new', ni: 'new', mkdir: 'mkdir', md: 'mkdir', 'get-content': 'cat', cat: 'cat', gc: 'cat', type: 'cat',
    'remove-item': 'rm', rm: 'rm', del: 'rm', ri: 'rm', rmdir: 'rm', 'copy-item': 'cp', cp: 'cp', copy: 'cp',
    'move-item': 'mv', 'rename-item': 'ren', ren: 'ren', mv: 'mv', move: 'mv', 'write-output': 'echo', echo: 'echo', 'clear-host': 'clear', cls: 'clear', clear: 'clear' },
  cmd: { cd: 'cd', chdir: 'cd', dir: 'ls', mkdir: 'mkdir', md: 'mkdir', type: 'cat', del: 'rm', erase: 'rm', rmdir: 'rmdir', rd: 'rmdir',
    copy: 'cp', move: 'mv', ren: 'ren', rename: 'ren', echo: 'echo', cls: 'clear' },
};

function parse(fl: Flavor, toks: Tok[]) {
  const pos: string[] = [], f = new Set<string>(), named: Record<string, string> = {};
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!t.q && fl === 'bash' && /^-[a-zA-Z]+$/.test(t.v)) for (const c of t.v.slice(1)) f.add(c);
    else if (!t.q && fl === 'ps' && /^-[a-zA-Z]+$/.test(t.v)) {
      const k = t.v.slice(1).toLowerCase(), n = toks[i + 1];
      if (!['recurse', 'force'].includes(k) && n && (n.q || !n.v.startsWith('-'))) named[k] = toks[++i].v; else f.add(k);
    } else if (!t.q && fl === 'cmd' && /^\/[a-zA-Z]$/.test(t.v)) f.add(t.v[1].toLowerCase());
    else pos.push(t.v);
  }
  return { pos, f, named };
}

function errText(m: Machine, code: Code, cmd: string, arg: string): string {
  const full = m.fmt(m.resolve(arg));
  if (m.flavor === 'bash') {
    const t = { ENOENT: 'No such file or directory', EEXIST: 'File exists', ENOTDIR: 'Not a directory', EISDIR: 'Is a directory', EINVAL: 'Invalid argument' }[code];
    if (code === 'EISDIR' && cmd === 'cp') return `cp: -r not specified; omitting directory '${arg}'`;
    if (code === 'EINVAL') return cmd === 'mv' ? `mv: cannot move '${arg}' to a subdirectory of itself` : `cp: cannot copy a directory, '${arg}', into itself`;
    const v: Record<string, string> = { mkdir: 'cannot create directory ', touch: 'cannot touch ', rm: 'cannot remove ', ls: 'cannot access ', cp: 'cannot stat ', mv: 'cannot stat ' };
    const verb = v[cmd];
    return cmd === 'cd' ? `bash: cd: ${arg}: ${t}` : `${cmd}: ${verb ? `${verb}'${arg}'` : arg}: ${t}`;
  }
  if (m.flavor === 'ps') {
    if (code === 'EINVAL') return 'The item cannot be moved or copied into itself.';
    if (code === 'EEXIST') return `An item with the specified name ${full} already exists.`;
    if (code === 'EISDIR') return `The item at ${full} has children and the Recurse parameter was not specified.`;
    return `Cannot find path '${full}' because it does not exist.`;
  }
  if (code === 'EINVAL') return 'Cannot perform a cyclic copy.';
  if (code === 'EEXIST' && ['ren', 'rename'].includes(cmd)) return 'A duplicate file name exists, or the file cannot be found.';
  if (code === 'EEXIST') return `A subdirectory or file ${arg} already exists.`;
  if (code === 'EISDIR') return cmd === 'rmdir' ? 'The directory is not empty.' : 'Access is denied.';
  if (code === 'ENOTDIR') return 'The directory name is invalid.';
  return ['cd', 'ls', 'mkdir', 'rmdir'].includes(cmd) ? 'The system cannot find the path specified.' : 'The system cannot find the file specified.';
}

export function run(m: Machine, line: string): Result {
  const fl = m.flavor;
  if (!line.trim()) return { out: '', err: '' };
  let toks: Tok[];
  try { toks = tokenize(line, fl); } catch (e) { return { out: '', err: (e as Error).message }; }
  // redirection (> and >>) is handled by all three shells
  let redirect: { path: string; append: boolean } | null = null;
  const ri = toks.findIndex(t => !t.q && (t.v === '>' || t.v === '>>'));
  if (ri >= 0) {
    if (!toks[ri + 1]) return { out: '', err: fl === 'bash' ? "bash: syntax error near unexpected token `newline'" : 'The syntax of the command is incorrect.' };
    redirect = { path: toks[ri + 1].v, append: toks[ri].v === '>>' };
    toks = [...toks.slice(0, ri), ...toks.slice(ri + 2)];
  }
  const raw = toks.shift()!;
  const name = fl === 'bash' ? raw.v : raw.v.toLowerCase();
  const op = ALIAS[fl][name];
  if (!op) return { out: '', err: fl === 'bash' ? `${raw.v}: not supported by this simulator (it only models a lesson-sized set of commands; nothing was run).`
    : `'${raw.v}' is not supported by this simulator. Nothing was run on your computer.` };
  const { pos, f, named } = parse(fl, toks);
  const err = (c: Code, arg: string) => ({ out: '', err: errText(m, c, name, arg) });
  const ok = (out = ''): Result => {
    if (!redirect) return { out, err: '' };
    const c = m.write(redirect.path, out ? out + '\n' : '', redirect.append);
    return c ? err(c, redirect.path) : { out: '', err: '' };
  };
  const rec = f.has('r') || f.has('R') || f.has('recurse') || f.has('s');
  const need = (n: number): Result | null => pos.length < n ? { out: '', err:
    fl === 'bash' ? `${name}: missing operand` : fl === 'ps' ? `${raw.v}: Cannot bind argument: a required parameter is missing.` : 'The syntax of the command is incorrect.' } : null;
  const each = (fn: (p: string) => Code | null): Result => { for (const p of pos) { const c = fn(p); if (c) return err(c, p); } return ok(); };

  switch (op) {
    case 'clear': return { out: '', err: '', clear: true };
    case 'echo': return ok(pos.join(' '));
    case 'pwd': return ok(m.fmt());
    case 'cd': {
      if (!pos.length) { if (fl === 'bash') { m.cwd = ['home', 'user']; return ok(); } return ok(fl === 'cmd' ? m.fmt() : ''); }
      const c = m.cd(named.path ?? pos.join(' ')); return c ? err(c, pos.join(' ')) : ok();
    }
    case 'ls': {
      const p = named.path ?? pos[0] ?? '.', r = m.list(p);
      if (typeof r === 'string') return err(r, p);
      const items = fl === 'bash' && !f.has('a') ? r.filter(x => !x.name.startsWith('.')) : r;
      if (fl === 'bash') return ok(items.map(x => x.name).join('  '));
      if (fl === 'ps') return ok(items.length ? ['Mode    Name', '----    ----', ...items.map(x => `${x.dir ? 'd-----' : '-a----'}  ${x.name}`)].join('\n') : '');
      return ok([` Directory of ${m.fmt(m.resolve(p))}`, '', ...items.map(x => (x.dir ? '<DIR>  ' : '       ') + x.name)].join('\n'));
    }
    case 'mkdir': { const n = need(1); return n ?? each(p => m.mkdir(p, f.has('p') || fl !== 'bash', fl !== 'bash' || !f.has('p'))); }
    case 'new': {
      const type = (named.itemtype ?? '').toLowerCase(), path = named.path ?? pos[0];
      if (!path && !named.name) return need(1)!;
      const target = named.name ? (path ?? '.') + (m.win ? '\\' : '/') + named.name : path;
      const c = type === 'directory' ? m.mkdir(target) : m.lookup(m.resolve(target)) ? 'EEXIST' : m.write(target, named.value ?? '');
      return c ? err(c, target) : ok();
    }
    case 'touch': { const n = need(1); return n ?? each(p => m.touch(p)); }
    case 'cat': { if (fl === 'cmd' && pos.length === 1 && pos[0].toLowerCase() === 'nul') return ok('');
      const n = need(1); if (n) return n; let out = ''; for (const p of pos) { const r = m.read(p); if (r === 'ENOENT' || r === 'EISDIR') return err(r, p); out += r; } return ok(out.replace(/\n$/, '')); }
    case 'rm': { const n = need(1); return n ?? each(p => m.remove(p, rec)); }
    case 'rmdir': { const n = need(1); return n ?? each(p => { const t = m.lookup(m.resolve(p)); if (t?.t === 'f') return 'ENOTDIR'; if (t?.t === 'd' && t.c.size && !f.has('s')) return 'EISDIR'; return m.remove(p, true); }); }
    case 'ren': { if (pos.length < 2) return need(2)!; if (m.lookup(m.resolve(pos[1]))) return err('EEXIST', pos[1]);
      const c = m.copy(pos[0], pos[1], true, true); return c ? err(c, pos[0]) : ok(); }
    case 'cp': case 'mv': { const a = pos[0] ?? named.path, b = pos[1] ?? named.destination; if (!a || !b) return need(2)!;
      const c = m.copy(a, b, rec, op === 'mv'); return c ? err(c, a) : ok(); }
  }
  return { out: '', err: 'Unhandled command.' };
}
