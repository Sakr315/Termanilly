import { describe, it, expect } from 'vitest';
import { Machine, Flavor } from './machine';
import { run } from './shells';
import { translate, Action, validName, q } from './translate';
const home = (m: Machine) => (m.win ? ['C:', 'Users', 'user'] : ['home', 'user']);
const gui = (m: Machine, a: Action) => { const t = translate(m.flavor, a); expect(t.cmd, t.error).toBeTruthy(); const r = run(m, t.cmd!); expect(r.err, t.cmd!).toBe(''); return t.cmd!; };
const FL: Flavor[] = ['bash', 'ps', 'cmd'];
describe('GUI -> command -> engine round trip', () => {
  for (const fl of FL) it(`${fl}: odd names survive quoting`, () => {
    const names = fl === 'bash' || fl === 'ps' ? ['plain', 'my folder', "it's", 'say "hi"', '-dash', 'a;b', 'x>y', '$HOME'] : ['plain', 'my folder', "it's", 'a&b', 'p%q'];
    for (const n of names) { const m = new Machine(fl); gui(m, { k: 'mkdir', name: n }); expect(m.lookup([...home(m), n])?.t, n).toBe('d'); }
  });
  for (const fl of FL) it(`${fl}: newfile, rename, delete, cd`, () => {
    const m = new Machine(fl); gui(m, { k: 'newfile', name: 'a b.txt' }); gui(m, { k: 'rename', from: 'a b.txt', to: 'c.txt' });
    expect(m.lookup([...home(m), 'c.txt'])?.t).toBe('f'); expect(m.lookup([...home(m), 'a b.txt'])).toBeUndefined();
    gui(m, { k: 'mkdir', name: 'd' }); gui(m, { k: 'cd', path: 'd' }); expect(m.cwd.at(-1)).toBe('d');
    gui(m, { k: 'cd', path: '..' }); gui(m, { k: 'delete', name: 'd', dir: true }); gui(m, { k: 'delete', name: 'c.txt', dir: false });
    expect(run(m, fl === 'bash' ? 'ls' : fl === 'ps' ? 'ls' : 'dir').out.replace(/^.*Directory of.*\n\n?/, '')).toBe('');
  });
  it('copy and move, including folders', () => {
    for (const fl of ['bash', 'ps'] as Flavor[]) { const m = new Machine(fl); gui(m, { k: 'mkdir', name: 'src' }); gui(m, { k: 'newfile', name: 'f' });
      gui(m, { k: 'copy', from: 'f', to: 'f2', dir: false }); gui(m, { k: 'copy', from: 'src', to: 'src2', dir: true }); gui(m, { k: 'move', from: 'f2', to: 'src2' });
      expect(m.lookup([...home(m), 'src2', 'f2'])?.t).toBe('f'); expect(m.lookup([...home(m), 'f'])?.t).toBe('f'); }
  });
  it('write: single-line uses echo and is stored; multi-line has no command', () => {
    const m = new Machine('bash'); const c = gui(m, { k: 'write', name: 'n.txt', text: "it's fine" });
    expect(c).toBe(`echo "it's fine" > n.txt`); expect(run(m, 'cat n.txt').out).toBe("it's fine");
    expect(translate('bash', { k: 'write', name: 'n', text: 'a\nb' }).cmd).toBeNull();
  });
});
describe('quoting and validation', () => {
  it('shows shell-specific commands', () => {
    expect(translate('ps', { k: 'mkdir', name: 'projects' }).cmd).toBe('New-Item -ItemType Directory -Name projects');
    expect(translate('cmd', { k: 'delete', name: 'x y', dir: true }).cmd).toBe('rd /s "x y"');
    expect(translate('ps', { k: 'delete', name: 'x', dir: true }).cmd).toBe('Remove-Item x -Recurse');
  });
  it('refuses what it cannot quote safely instead of guessing', () => {
    expect(q('bash', `a'b"c`)).toBeNull(); expect(q('cmd', 'a"b')).toBeNull(); expect(q('bash', 'x\ny')).toBeNull();
    expect(translate('bash', { k: 'mkdir', name: `a'b"c` }).error).toContain('cannot be written');
    expect(translate('cmd', { k: 'copy', from: 'a', to: 'b', dir: true }).cmd).toBeNull();
  });
  it('validates names per OS', () => {
    expect(validName('bash', 'a:b')).toBeNull(); expect(validName('cmd', 'a:b')).toBeTruthy(); expect(validName('ps', 'NUL.txt')).toBeTruthy();
    expect(validName('bash', 'a/b')).toBeTruthy(); expect(validName('bash', '..')).toBeTruthy();
  });
});
describe('engine additions', () => {
  it('ren refuses to overwrite; type nul creates an empty file', () => {
    const m = new Machine('cmd'); run(m, 'type nul > a'); run(m, 'type nul > b');
    expect(run(m, 'ren a b').err).toContain('duplicate'); expect(run(m, 'ren a c').err).toBe(''); expect(m.lookup([...home(m), 'c'])?.t).toBe('f');
    expect(sh2('ps', 'Rename-Item x y').err).toContain('Cannot find path');
  });
  it('terminal changes are visible through the shared machine (no GUI needed)', () => {
    const m = new Machine('bash'); run(m, 'mkdir projects'); run(m, 'cd projects'); run(m, 'touch notes.txt');
    expect(m.fmt()).toBe('/home/user/projects'); expect((m.list('.') as any[]).map(x => x.name)).toEqual(['notes.txt']);
  });
});
const sh2 = (f: Flavor, l: string) => run(new Machine(f), l);
