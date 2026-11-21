import { describe, it, expect } from 'vitest';
import { Machine, Flavor } from './machine';
import { run } from './shells';
import { lessons, challenges } from './content';
import { parseBackup, makeBackup, defS, defP } from './backup';
import { exportSession, importSession } from './session';
const FL: Flavor[] = ['bash', 'ps', 'cmd'];
const V = (f: Flavor) => ({ mv: { bash: 'mv', ps: 'Move-Item', cmd: 'move' }[f], cp: { bash: 'cp', ps: 'Copy-Item', cmd: 'copy' }[f], ren: { bash: 'mv', ps: 'Rename-Item', cmd: 'ren' }[f], mk: { bash: 'touch', ps: 'New-Item', cmd: 'type nul >' }[f], rm: { bash: 'rm', ps: 'Remove-Item', cmd: 'del' }[f] });
const sep = (f: Flavor, p: string) => (f === 'cmd' ? p.replace(/\//g, '\\') : p);
const mk = (f: Flavor, seed?: (m: Machine) => void) => { const m = new Machine(f); seed?.(m); return m; };
const go = (m: Machine, cmds: string[]) => cmds.forEach(c => expect(run(m, c).err, c).toBe(''));

const LESSON: Record<string, (f: Flavor) => string[][]> = {
  'first-folder': f => [['mkdir study'], ['cd study'], [`${V(f).mk} notes.txt`]],
  paths: f => [[`cd ${sep(f, 'projects/web/src')}`], ['cd ..', 'cd ..'], [f === 'bash' ? 'cd /home/user' : 'cd C:\\Users\\user']],
  'copy-move': f => [[`${V(f).cp} notes.txt archive`], [`${V(f).ren} notes.txt todo.txt`], [`${V(f).rm} ${sep(f, 'archive/notes.txt')}`]],
  'text-files': () => [['echo hello > hello.txt'], ['echo world >> hello.txt']],
  quoting: f => [['mkdir "my notes"'], ['cd "my notes"'], [`${V(f).mk} "a b.txt"`]],
};
describe('lessons keep state across steps and validate real outcomes', () => {
  it('every lesson has a scripted solution', () => expect(lessons.map(l => l.id).sort()).toEqual(Object.keys(LESSON).sort()));
  for (const L of lessons) for (const f of FL) it(`${L.id} (${f})`, () => {
    const m = mk(f, L.seed), sol = LESSON[L.id](f);
    expect(sol.length).toBe(L.steps.length);
    L.steps.forEach((st, i) => { expect(st.check(m), `${st.title} must not pass before acting`).toBe(false); go(m, sol[i]); expect(st.check(m), st.title).toBe(true); });
  });
  it('bash is case-sensitive in step checks', () => { const m = mk('bash'); go(m, ['mkdir Study', 'cd Study']); expect(lessons[0].steps[1].check(m)).toBe(false); });
});
const CH: Record<string, (f: Flavor) => string[]> = {
  c1: f => ['mkdir projects', 'cd projects', `${V(f).mk} notes.txt`],
  c2: f => ['mkdir backup', `${V(f).cp} notes.txt backup`], c3: f => [`${V(f).mv} draft.txt archive`],
  c4: f => f === 'bash' ? ['mkdir -p a/b/c', 'cd a/b/c', 'touch readme.md'] : ['mkdir ' + sep(f, 'a/b/c'), 'cd ' + sep(f, 'a/b/c'), `${V(f).mk} readme.md`],
  c5: f => [`${V(f).ren} old.txt new.txt`], c6: () => ['echo hello > note.txt'],
  c7: f => ['mkdir docs', 'mkdir images', ...['a.txt', 'b.txt'].map(x => `${V(f).mv} ${x} docs`), ...['photo1.jpg', 'photo2.jpg'].map(x => `${V(f).mv} ${x} images`)],
  c8: f => f === 'bash' ? ['cp -r project project-backup'] : f === 'ps' ? ['Copy-Item project project-backup -Recurse'] : ['md project-backup\\src', 'copy project\\notes.txt project-backup', 'copy project\\src\\main.txt project-backup\\src'],
};
describe('challenges validate outcomes in all shells', () => {
  it('every challenge has a solution and a level', () => { expect(challenges.map(c => c.id).sort()).toEqual(Object.keys(CH).sort()); expect(new Set(challenges.map(c => c.level))).toEqual(new Set(['Easy', 'Medium', 'Hard'])); });
  for (const c of challenges) for (const f of FL) it(`${c.id} ${f}`, () => { const m = mk(f, c.seed); expect(c.check(m)).toBe(false); go(m, CH[c.id](f)); expect(c.check(m)).toBe(true); });
  it('wrong approaches do not pass (copy instead of move; move instead of copy)', () => {
    const c3 = challenges.find(c => c.id === 'c3')!, m = mk('bash', c3.seed); go(m, ['cp draft.txt archive']); expect(c3.check(m)).toBe(false);
    const c2 = challenges.find(c => c.id === 'c2')!, n = mk('bash', c2.seed); go(n, ['mkdir backup', 'mv notes.txt backup']); expect(c2.check(n)).toBe(false);
  });
});
describe('backup import validation', () => {
  const good = () => JSON.parse(makeBackup({ ...defS, theme: 'ocean' }, { ...defP, lessons: ['paths'], commands: { ls: 3 } }));
  it('round-trips', () => { const r = parseBackup(makeBackup({ ...defS, theme: 'ocean' }, { ...defP, lessons: ['paths'], commands: { ls: 3 }, minutes: 7 })); expect('error' in r).toBe(false); if (!('error' in r)) { expect(r.settings.theme).toBe('ocean'); expect(r.progress.commands.ls).toBe(3); } });
  it('rejects bad input', () => {
    const bad = (f: (j: any) => void) => { const j = good(); f(j); return 'error' in parseBackup(JSON.stringify(j)); };
    expect(parseBackup('nope')).toHaveProperty('error'); expect(parseBackup('{"app":"x"}')).toHaveProperty('error');
    expect(bad(j => (j.settings.theme = 'evil'))).toBe(true); expect(bad(j => (j.settings.fontSize = 999))).toBe(true);
    expect(bad(j => (j.progress.lessons = [1]))).toBe(true); expect(bad(j => (j.progress.minutes = -5))).toBe(true); expect(bad(j => (j.version = 2))).toBe(true);
  });
  it('does not allow prototype pollution', () => {
    const t = '{"app":"terminally","version":1,"settings":' + JSON.stringify(defS) + ',"progress":{"lessons":[],"challenges":[],"bookmarks":[],"minutes":0,"commands":{"__proto__":{"x":1}}}}';
    expect(parseBackup(t)).toHaveProperty('error'); expect(({} as any).x).toBeUndefined();
  });
});
describe('session import/export', () => {
  it('round-trips the filesystem and cwd for each shell', () => {
    for (const f of FL) { const m = new Machine(f); run(m, 'mkdir "a b"'); run(m, 'cd "a b"'); run(m, 'echo hi > f.txt'); const r = importSession(exportSession(m)); expect('m' in r).toBe(true);
      if ('m' in r) { expect(r.m.fmt()).toBe(m.fmt()); expect(run(r.m, f === 'cmd' ? 'type f.txt' : 'cat f.txt').out).toBe('hi'); expect(r.m.flavor).toBe(f); } }
  });
  const tree = (d: any) => JSON.stringify({ app: 'terminally-session', version: 1, flavor: 'bash', cwd: [], tree: { d } });
  it('rejects hostile sessions', () => {
    expect(importSession(tree({ '..': { d: {} } }))).toHaveProperty('error'); expect(importSession(tree({ 'a/b': { f: '' } }))).toHaveProperty('error');
    expect(importSession(tree({ a: { f: 5 } }))).toHaveProperty('error'); expect(importSession('{"app":"nope"}')).toHaveProperty('error');
    expect(importSession(JSON.stringify({ app: 'terminally-session', version: 1, flavor: 'zsh', cwd: [], tree: { d: {} } }))).toHaveProperty('error');
    expect(importSession(JSON.stringify({ app: 'terminally-session', version: 1, flavor: 'bash', cwd: ['missing'], tree: { d: {} } }))).toHaveProperty('error');
    let deep: any = { f: '' }; for (let i = 0; i < 60; i++) deep = { d: { x: deep } };
    expect(importSession(JSON.stringify({ app: 'terminally-session', version: 1, flavor: 'bash', cwd: [], tree: deep }))).toHaveProperty('error');
    const many: any = {}; for (let i = 0; i < 6000; i++) many['f' + i] = { f: '' }; expect(importSession(tree(many))).toHaveProperty('error');
  });
  it('rejects Windows-invalid and case-duplicate names', () => {
    const w = (d: any) => JSON.stringify({ app: 'terminally-session', version: 1, flavor: 'cmd', cwd: [], tree: { d: { 'C:': { d } } } });
    expect(importSession(w({ 'a:b': { f: '' } }))).toHaveProperty('error'); expect(importSession(w({ A: { f: '' }, a: { f: '' } }))).toHaveProperty('error');
  });
});
