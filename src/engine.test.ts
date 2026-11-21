import { describe, it, expect } from 'vitest';
import { Machine } from './machine';
import { run } from './shells';
const sh = (f: 'bash' | 'ps' | 'cmd') => { const m = new Machine(f); return { m, r: (l: string) => run(m, l) }; };

describe('bash', () => {
  it('mkdir, cd, touch, ls update state', () => {
    const { m, r } = sh('bash');
    r('mkdir study'); r('cd study'); r('touch notes.txt');
    expect(m.fmt()).toBe('/home/user/study');
    expect(r('ls').out).toBe('notes.txt');
  });
  it('is case-sensitive', () => { const { r } = sh('bash'); r('mkdir Docs'); expect(r('cd docs').err).toContain('No such file or directory'); });
  it('mkdir -p and error on missing parent', () => {
    const { r } = sh('bash');
    expect(r('mkdir a/b').err).toContain("cannot create directory 'a/b'");
    expect(r('mkdir -p a/b').err).toBe(''); expect(r('ls a').out).toBe('b');
  });
  it('quoted paths and redirection', () => {
    const { r } = sh('bash'); r("mkdir 'my dir'"); r('echo hi > "my dir/a.txt"');
    expect(r('cat "my dir/a.txt"').out).toBe('hi');
  });
  it('rm needs -r for directories; unsupported commands are refused', () => {
    const { r } = sh('bash'); r('mkdir d');
    expect(r('rm d').err).toContain('Is a directory'); expect(r('rm -r d').err).toBe('');
    expect(r('sudo reboot').err).toContain('not supported');
  });
});
describe('powershell', () => {
  it('uses parameters and is case-insensitive', () => {
    const { m, r } = sh('ps');
    r('New-Item -ItemType Directory -Name Projects'); r('cd projects');
    r('New-Item -ItemType File -Name notes.txt');
    expect(m.fmt()).toBe('C:\\Users\\user\\Projects');
    expect(r('Get-ChildItem').out).toContain('notes.txt');
  });
  it('PowerShell-style error', () => { expect(sh('ps').r('Set-Location nope').err).toContain("Cannot find path 'C:\\Users\\user\\nope'"); });
});
describe('cmd', () => {
  it('md/cd/dir/type with backslashes and drive letters', () => {
    const { m, r } = sh('cmd');
    r('md work'); r('cd work'); r('echo hello > a.txt');
    expect(r('type a.txt').out).toBe('hello'); expect(r('dir').out).toContain('a.txt');
    r('cd \\'); expect(m.fmt()).toBe('C:\\'); r('cd C:\\Users\\user'); expect(m.fmt()).toBe('C:\\Users\\user');
  });
  it('cmd error text and flags', () => {
    const { r } = sh('cmd'); r('md x');
    expect(r('md x').err).toBe('A subdirectory or file x already exists.');
    expect(r('rd x').err).toBe(''); expect(r('cd x').err).toBe('The system cannot find the path specified.');
  });
});
describe('isolation', () => { it('machines do not share state', () => { const a = sh('bash'), b = sh('bash'); a.r('mkdir x'); expect(b.r('ls').out).toBe(''); }); });
describe('regressions (copy/move)', () => {
  it('refuses to copy or move a folder into itself', () => {
    const { r } = sh('bash'); r('mkdir -p a/b');
    expect(r('cp -r a a/b').err).toContain('into itself');
    expect(r('mv a a/b').err).toContain('subdirectory of itself');
    expect(sh('cmd').r('md a').err).toBe('');
  });
  it('cp without -r on a folder explains the flag', () => { const { r } = sh('bash'); r('mkdir d'); expect(r('cp d e').err).toContain('-r not specified'); });
  it('cp/mv onto the same path is a harmless no-op', () => { const { r } = sh('bash'); r('touch a'); expect(r('mv a a').err).toBe(''); expect(r('ls').out).toBe('a'); });
  it('cp -r copies contents; mv removes the source', () => {
    const { r } = sh('bash'); r('mkdir -p d'); r('echo x > d/f'); r('cp -r d e');
    expect(r('cat e/f').out).toBe('x'); r('mv d g'); expect(r('ls').out).toBe('e  g');
  });
  it('windows copy into folder keeps name; drive-relative cd keeps casing', () => {
    const { m, r } = sh('cmd'); r('md Docs'); r('echo a > f.txt'); r('copy f.txt docs'); expect(r('dir docs').out).toContain('f.txt');
    r('cd DOCS'); expect(m.fmt()).toBe('C:\\Users\\user\\Docs');
  });
  it('powershell mkdir of existing folder errors', () => { const { r } = sh('ps'); r('mkdir a'); expect(r('mkdir a').err).toContain('already exists'); });
});
