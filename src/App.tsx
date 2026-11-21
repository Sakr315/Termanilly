import { useEffect, useMemo, useRef, useState } from 'react';
import { Home, BookOpen, Target, Terminal as TermIcon, Library, BarChart3, Settings as Cog, Palette, PanelLeft, Folder, FileText, Star, RotateCcw, Check, Lightbulb } from 'lucide-react';
import { Machine, Flavor, Node } from './machine';
import { run, Result } from './shells';
import { initStore, load, save } from './store';
import { Explorer } from './Explorer';
import { Action, Tr, translate, SHELL_NAME } from './translate';
import { defS, defP, S, P, parseBackup, makeBackup } from './backup';
import { exportSession, importSession } from './session';
import { lessons, challenges, library, homeOf, Challenge } from './content';

type View = 'home' | 'learn' | 'practice' | 'playground' | 'library' | 'progress' | 'settings';
const NAV: [View, string, typeof Home][] = [['home', 'Home', Home], ['learn', 'Learn', BookOpen], ['practice', 'Practice', Target], ['playground', 'Playground', TermIcon], ['library', 'Command Library', Library], ['progress', 'Progress', BarChart3], ['settings', 'Settings', Cog]];
const THEMES = [['paper', 'Paper'], ['midnight', 'Midnight'], ['matcha', 'Matcha'], ['rose', 'Rose'], ['mocha', 'Mocha'], ['ocean', 'Ocean']];
const SHELLS: [Flavor, string][] = [['bash', 'Bash'], ['ps', 'PowerShell'], ['cmd', 'CMD']];
const mk = (fl: Flavor, seed?: (m: Machine) => void) => { const m = new Machine(fl); seed?.(m); return m; };

export default function App() {
  const [view, setView] = useState<View>('home');
  const [s, setS] = useState(defS), [p, setP] = useState(defP), [ready, setReady] = useState(false), [saveErr, setSaveErr] = useState(false);
  useEffect(() => { (async () => { await initStore(); setS(await load('settings', defS)); setP(await load('progress', defP)); setReady(true); })(); }, []);
  useEffect(() => { if (ready) save('settings', s).then(ok => setSaveErr(!ok)); }, [s, ready]);
  useEffect(() => { if (ready) save('progress', p).then(ok => setSaveErr(!ok)); }, [p, ready]);
  useEffect(() => { const d = document.documentElement; d.dataset.theme = s.theme; d.style.fontSize = s.fontSize + 'px'; d.dataset.motion = s.reduceMotion ? 'reduced' : ''; }, [s]);
  useEffect(() => { const t = setInterval(() => document.hasFocus() && setP(x => ({ ...x, minutes: x.minutes + 1 })), 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 7) { e.preventDefault(); setView(NAV[n - 1][0]); }
      else if (e.key === ',') { e.preventDefault(); setView('settings'); }
      else if (e.key.toLowerCase() === 'k') { e.preventDefault(); setView('library'); setTimeout(() => document.getElementById('search')?.focus(), 50); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const mark = (key: 'lessons' | 'challenges', id: string) => setP(x => x[key].includes(id) ? x : { ...x, [key]: [...x[key], id] });
  const count = (c: string) => setP(x => ({ ...x, commands: { ...x.commands, [c]: (x.commands[c] ?? 0) + 1 } }));
  const nextTheme = () => setS(x => ({ ...x, theme: THEMES[(THEMES.findIndex(t => t[0] === x.theme) + 1) % 6][0] }));
  const title = NAV.find(n => n[0] === view)![1];
  return (
    <div className="flex h-screen">
      <nav aria-label="Main" className={`flex flex-col border-r border-line bg-surface py-4 ${s.collapsed ? 'w-14' : 'w-52'}`}>
        <div className="px-4 pb-5 font-serif text-lg">{s.collapsed ? 't.' : 'terminally.'}</div>
        {NAV.map(([id, label, Icon], i) => (
          <button key={id} onClick={() => setView(id)} title={`${label}  Ctrl+${i + 1}`} aria-current={view === id ? 'page' : undefined}
            className={`mx-2 flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${view === id ? 'bg-hl text-fg' : 'text-muted hover:bg-hl'}`}>
            <Icon size={16} strokeWidth={1.6} />{!s.collapsed && <><span className="flex-1">{label}</span><kbd>{i + 1}</kbd></>}
          </button>))}
        <button onClick={() => setS({ ...s, collapsed: !s.collapsed })} aria-label="Collapse sidebar" className="mx-2 mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-hl"><PanelLeft size={16} strokeWidth={1.6} />{!s.collapsed && 'Collapse'}</button>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-8 py-3 text-sm text-muted">
          <span>{title}</span>
          <span className="flex items-center gap-3">{saveErr && <span role="alert" style={{ color: 'var(--err)' }}>Couldn’t save to the local database — recent progress may be lost.</span>}<span>Search <kbd>Ctrl K</kbd></span>
            <button onClick={nextTheme} className="btn flex items-center gap-2" aria-label="Switch theme"><Palette size={14} />{THEMES.find(t => t[0] === s.theme)![1]}</button></span>
        </header>
        <main className="flex-1 overflow-y-auto px-8 py-8"><div className="mx-auto max-w-4xl">
          {view === 'home' && <HomeView p={p} go={setView} />}
          {view === 'learn' && <LearnView s={s} p={p} onDone={id => mark('lessons', id)} onCmd={count} />}
          {view === 'practice' && <PracticeView s={s} p={p} onPass={id => mark('challenges', id)} onCmd={count} />}
          {view === 'playground' && <Playground s={s} onCmd={count} />}
          {view === 'library' && <LibraryView p={p} setP={setP} />}
          {view === 'progress' && <ProgressView p={p} />}
          {view === 'settings' && <SettingsView s={s} setS={setS} p={p} setP={setP} reset={() => { setS(defS); setP(defP); }} />}
        </div></main>
      </div>
    </div>);
}

const H = ({ children, sub }: { children: React.ReactNode; sub?: string }) => <div className="mb-8"><h1 className="font-serif text-3xl leading-tight">{children}</h1>{sub && <p className="mt-2 max-w-xl text-muted">{sub}</p>}</div>;
const Bar = ({ v }: { v: number }) => <div className="h-1 w-full overflow-hidden rounded bg-hl"><div className="h-full rounded bg-accent transition-all" style={{ width: `${Math.round(v * 100)}%` }} /></div>;

function HomeView({ p, go }: { p: P; go: (v: View) => void }) {
  const next = lessons.find(l => !p.lessons.includes(l.id)), L = next ?? lessons[0];
  return <><H sub="A quiet place to learn how computers and terminals work. Everything runs in a simulation — nothing touches your real files.">Welcome back.</H>
    <div className="border-t border-line pt-6"><div className="text-xs uppercase tracking-wide text-muted">{next ? (p.lessons.length ? 'Continue' : 'Start here') : 'All lessons complete'}</div>
      <h2 className="mt-1 font-serif text-xl">{L.title}</h2><p className="mt-1 text-muted">{L.blurb}</p>
      <div className="mt-4 flex gap-2"><button className="btn btn-primary" onClick={() => go('learn')}>{next ? 'Open lessons' : 'Review lessons'}</button><button className="btn" onClick={() => go('practice')}>Try a challenge</button><button className="btn" onClick={() => go('playground')}>Open playground</button></div></div></>;
}

function Tabs({ fl, set }: { fl: Flavor; set: (f: Flavor) => void }) {
  return <div role="tablist" className="inline-flex rounded-lg border border-line p-0.5 text-sm">{SHELLS.map(([id, l]) => <button role="tab" aria-selected={fl === id} key={id} onClick={() => set(id)} className={`rounded-md px-3 py-1 ${fl === id ? 'bg-hl text-fg' : 'text-muted'}`}>{l}</button>)}</div>;
}

type L = { k: 'cmd' | 'out' | 'err'; t: string; p?: string };
function Term({ m, size, lines, exec }: { m: Machine; size: number; lines: L[]; exec: (line: string) => void }) {
  const [val, setVal] = useState('');
  const hist = useRef<string[]>([]), hi = useRef(0), end = useRef<HTMLDivElement>(null), inp = useRef<HTMLInputElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [lines]);
  const submit = () => { exec(val); if (val.trim()) hist.current.push(val); hi.current = hist.current.length; setVal(''); };
  const complete = () => {
    const last = val.split(/\s+/).pop() ?? '', i = Math.max(last.lastIndexOf('/'), last.lastIndexOf('\\')), base = last.slice(0, i + 1), part = last.slice(i + 1);
    const l = m.list(base || '.'); if (typeof l === 'string') return;
    const c = l.filter(x => (m.win ? x.name.toLowerCase().startsWith(part.toLowerCase()) : x.name.startsWith(part)));
    if (!c.length) return;
    let pre = c[0].name; for (const x of c) while (!x.name.toLowerCase().startsWith(pre.toLowerCase())) pre = pre.slice(0, -1);
    setVal(val.slice(0, val.length - part.length) + pre + (c.length === 1 && c[0].dir ? (m.win ? '\\' : '/') : ''));
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi.current > 0) setVal(hist.current[--hi.current]); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi.current < hist.current.length - 1) setVal(hist.current[++hi.current]); else { hi.current = hist.current.length; setVal(''); } }
    else if (e.key === 'Tab') { e.preventDefault(); complete(); }
  };
  return <div onClick={() => inp.current?.focus()} className="h-72 overflow-y-auto rounded-xl p-4 font-mono" style={{ background: 'var(--tbg)', color: 'var(--ttext)', fontSize: size }} role="log" aria-label="Simulated terminal">
    {lines.map((l, i) => <div key={i} className="whitespace-pre-wrap break-words" style={l.k === 'err' ? { color: 'var(--err)' } : undefined}>{l.k === 'cmd' ? <><span style={{ color: 'var(--prompt)' }}>{l.p}</span> {l.t}</> : l.t}</div>)}
    <div className="flex gap-2"><span style={{ color: 'var(--prompt)' }}>{m.prompt()}</span>
      <input ref={inp} value={val} onChange={e => setVal(e.target.value)} onKeyDown={key} spellCheck={false} aria-label="Command input" className="min-w-0 flex-1 bg-transparent outline-none" style={{ caretColor: 'var(--prompt)' }} /></div><div ref={end} /></div>;
}

function Sandbox({ fl, seed, onState, onCmd, size, mref }: { fl: Flavor; seed?: (m: Machine) => void; onState?: (m: Machine) => void; onCmd: (c: string) => void; size: number; mref?: React.MutableRefObject<Machine | null> }) {
  const [n, setN] = useState(0), [t, setT] = useState(0), [lines, setLines] = useState<L[]>([]), [tr, setTr] = useState<{ a: Action; t: Tr } | null>(null);
  const m = useMemo(() => mk(fl, seed), [fl, seed, n]);
  if (mref) mref.current = m;
  const bump = () => { setT(x => x + 1); onState?.(m); };
  // The single place where anything (typed or clicked) touches the machine: one execution, one log entry.
  const exec = (line: string): Result => {
    const pr = m.prompt(), r = run(m, line);
    const add: L[] = [{ k: 'cmd', p: pr, t: line }, ...(r.out ? [{ k: 'out' as const, t: r.out }] : []), ...(r.err ? [{ k: 'err' as const, t: r.err }] : [])];
    setLines(l => (r.clear ? [] : [...l, ...add]));
    const c = line.trim().split(/\s+/)[0]?.toLowerCase(); if (c && !r.err) onCmd(c);
    bump(); return r;
  };
  const act = (a: Action): string | null => {
    const x = translate(m.flavor, a);
    if (x.cmd === null) { if (a.k === 'write' && !x.error) { const c = m.write(a.name, a.text); if (c) return `Could not save (${c}).`; setTr({ a, t: x }); bump(); return null; } return x.error ?? x.explain; }
    const r = exec(x.cmd); if (!r.err) setTr({ a, t: x }); return r.err || null;
  };
  return <div><div className="mb-2 flex items-center justify-between text-xs text-muted"><span>Simulated environment — nothing here touches your real files.</span>
    <button className="btn flex items-center gap-1" onClick={() => { setN(n + 1); setLines([]); setTr(null); }}><RotateCcw size={12} />Reset</button></div>
    <div className="grid gap-3 md:grid-cols-2"><Explorer key={n + fl} m={m} tick={t} act={act} /><Term m={m} size={size} lines={lines} exec={exec} /></div>
    {tr && <div className="row-in mt-3 rounded-xl border border-line bg-surface p-4 text-sm" aria-live="polite">
      <div className="text-xs uppercase tracking-wide text-muted">That click ran in {SHELL_NAME[fl]}</div>
      <div className="mt-1 font-mono">{tr.t.cmd ?? '(no single command)'}</div><p className="mt-2">{tr.t.explain}</p><p className="mt-1 text-muted">Result: {tr.t.result}</p>
      <div className="mt-3 border-t border-line pt-2 text-xs text-muted">{(['bash', 'ps', 'cmd'] as Flavor[]).filter(f => f !== fl).map(f => { const o = translate(f, tr.a); return <div key={f}><span className="inline-block w-24">{SHELL_NAME[f]}</span><span className="font-mono">{o.cmd ?? (o.error ?? 'no single command')}</span></div>; })}</div></div>}</div>;
}

function LearnView({ s, p, onDone, onCmd }: { s: S; p: P; onDone: (id: string) => void; onCmd: (c: string) => void }) {
  const [li, setLi] = useState(0), [fl, setFl] = useState<Flavor>('bash'), [i, setI] = useState(0), [ok, setOk] = useState(false);
  const L = lessons[li], st = L.steps[i], last = i === L.steps.length - 1, done = p.lessons.includes(L.id), mods = [...new Set(lessons.map(l => l.module))];
  const restart = () => { setI(0); setOk(false); };
  const rows: [string, string, boolean][] = [['Bash', st.cmds.bash, fl === 'bash'], ['PowerShell', st.cmds.ps, fl === 'ps'], ['CMD', st.cmds.cmd, fl === 'cmd'], ['File Explorer', st.cmds.gui, false]];
  return <><H sub={L.blurb}>{L.title}</H>
    <div className="mb-6 space-y-3">{mods.map(mod => <div key={mod}><div className="mb-1 text-xs uppercase tracking-wide text-muted">{mod}</div><div className="flex flex-wrap gap-2">{lessons.map((l, idx) => l.module === mod && <button key={l.id} className={`btn ${li === idx ? 'bg-hl' : ''}`} onClick={() => { setLi(idx); restart(); }}>{p.lessons.includes(l.id) && <Check size={12} className="mr-1 inline" />}{l.title}</button>)}</div></div>)}</div>
    <div className="mb-6 flex items-center justify-between"><Tabs fl={fl} set={f => { setFl(f); restart(); }} /><span className="text-sm text-muted">Step {i + 1} of {L.steps.length}</span></div>
    <Bar v={(i + (ok ? 1 : 0)) / L.steps.length} />
    <h2 className="mt-6 font-serif text-2xl">{st.title}</h2><p className="mt-2 max-w-2xl leading-relaxed">{st.concept}</p>
    {s.showWin && <div className="mt-4 max-w-2xl border-l-2 border-accent pl-4 text-muted"><span className="text-fg">In Windows: </span>{st.windows}</div>}
    <table className="mt-6 w-full max-w-2xl text-sm"><tbody>{rows.map(([k, v, a]) => <tr key={k} className="border-t border-line"><td className={`w-32 py-2 ${a ? 'text-fg' : 'text-muted'}`}>{k}</td><td className={`py-2 ${k === 'File Explorer' ? '' : 'font-mono'} ${a ? 'text-fg' : 'text-muted'}`}>{v}</td></tr>)}</tbody></table>
    <p className="mt-2 max-w-2xl text-xs text-muted">{st.note}</p>
    <p className="mb-3 mt-8 text-sm"><span className="text-muted">Your turn: </span>{st.goal} <span className="text-muted">(Typing or clicking both count.)</span></p>
    <Sandbox key={L.id + fl} fl={fl} seed={L.seed} size={s.termSize} onCmd={onCmd} onState={m => { if (!ok && st.check(m)) setOk(true); }} />
    {ok && <div className="row-in mt-6 max-w-2xl"><div className="flex items-center gap-2 text-sm" style={{ color: 'var(--accent)' }}><Check size={16} />Done.</div><p className="mt-1 text-muted">{st.why}</p>
      <div className="mt-4 flex gap-2">{last ? <><button className="btn btn-primary" disabled={done} onClick={() => onDone(L.id)}>{done ? 'Lesson complete' : 'Finish lesson'}</button>{done && li < lessons.length - 1 && <button className="btn" onClick={() => { setLi(li + 1); restart(); }}>Next lesson</button>}</>
        : <button className="btn btn-primary" onClick={() => { setI(i + 1); setOk(false); }}>Next step</button>}</div></div>}</>;
}

function PracticeView({ s, p, onPass, onCmd }: { s: S; p: P; onPass: (id: string) => void; onCmd: (c: string) => void }) {
  const [ch, setCh] = useState<Challenge>(challenges[0]), [fl, setFl] = useState<Flavor>('bash'), [h, setH] = useState(0), [ok, setOk] = useState(false);
  const pick = (c: Challenge) => { setCh(c); setH(0); setOk(false); };
  return <><H sub="Challenges check the actual state of the simulated filesystem, so any valid approach works.">Practice</H>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{challenges.map(c => <button key={c.id} onClick={() => pick(c)} className={`btn ${ch.id === c.id ? 'bg-hl' : ''}`}>{p.challenges.includes(c.id) && <Check size={12} className="mr-1 inline" />}{c.title} <span className="text-xs text-muted">{c.level}</span></button>)}</div>
      <Tabs fl={fl} set={f => { setFl(f); setOk(false); }} /></div>
    <div className="mb-1 text-xs uppercase tracking-wide text-muted">{ch.level}</div><p className="mb-4 max-w-2xl text-lg">{ch.task}</p>
    <Sandbox key={ch.id + fl} fl={fl} seed={ch.seed} size={s.termSize} onCmd={onCmd} onState={m => { if (ch.check(m)) { setOk(true); onPass(ch.id); } }} />
    <div className="mt-4 flex items-center gap-3">{ok ? <span className="row-in flex items-center gap-2 text-sm" style={{ color: 'var(--accent)' }}><Check size={16} />Challenge complete.</span>
      : <button className="btn flex items-center gap-2" disabled={h >= ch.hints.length} onClick={() => setH(h + 1)}><Lightbulb size={14} />{h ? 'Another hint' : 'Show a hint'}</button>}</div>
    {ch.hints.slice(0, h).map((x, i) => <p key={i} className="row-in mt-2 text-sm text-muted">{i + 1}. {x}</p>)}</>;
}

function Transfer({ getText, apply, noun }: { getText: () => string | null; apply: (t: string) => string; noun: string }) {
  const [mode, setMode] = useState<'' | 'x' | 'i'>(''), [t, setT] = useState(''), [msg, setMsg] = useState('');
  return <div className="mt-3"><div className="flex gap-2">
    <button className="btn" onClick={() => { const x = getText(); if (x === null) { setMsg('Nothing to export yet.'); return; } setT(x); setMode('x'); setMsg(''); }}>Export {noun}</button>
    <button className="btn" onClick={() => { setT(''); setMode('i'); setMsg(''); }}>Import {noun}</button></div>
    {mode && <><textarea value={t} onChange={e => setT(e.target.value)} readOnly={mode === 'x'} rows={6} aria-label={`${noun} JSON`} className="mt-2 w-full rounded-lg border border-line bg-surface p-2 font-mono text-xs outline-none" />
      <div className="mt-2 flex gap-2">{mode === 'x' ? <button className="btn" onClick={() => navigator.clipboard?.writeText(t).then(() => setMsg('Copied.'), () => setMsg('Select the text and copy it manually.'))}>Copy</button> : <button className="btn btn-primary" onClick={() => setMsg(apply(t))}>Apply</button>}</div></>}
    {msg && <p role="status" className="mt-2 text-sm text-muted">{msg}</p>}</div>;
}

function Playground({ s, onCmd }: { s: S; onCmd: (c: string) => void }) {
  const [fl, setFl] = useState<Flavor>('bash'), [seed, setSeed] = useState<((m: Machine) => void) | undefined>(), [k, setK] = useState(0), [msg, setMsg] = useState('');
  const mref = useRef<Machine | null>(null);
  const loadText = (t: string): string => {
    const r = importSession(t); if ('error' in r) return r.error;
    setFl(r.m.flavor); setSeed(() => (m: Machine) => { const x = importSession(t); if ('m' in x) { m.root = x.m.root; m.cwd = x.m.cwd; } }); setK(x => x + 1); return 'Session loaded.';
  };
  return <><H sub="Experiment freely. Unsupported commands are refused with an explanation — never faked.">Playground</H>
    <div className="mb-4 flex flex-wrap items-center gap-2"><Tabs fl={fl} set={f => { setFl(f); setSeed(undefined); setK(x => x + 1); }} />
      <button className="btn" onClick={async () => setMsg((await save('session', { text: exportSession(mref.current!) })) ? 'Session saved on this computer.' : 'Could not save the session.')}>Save session</button>
      <button className="btn" onClick={async () => { const r = await load<{ text: string }>('session', { text: '' }); setMsg(r.text ? loadText(r.text) : 'No saved session yet.'); }}>Resume saved</button></div>
    {msg && <p role="status" className="mb-3 text-sm text-muted">{msg}</p>}
    <Sandbox key={fl + k} fl={fl} seed={seed} size={s.termSize} onCmd={onCmd} mref={mref} />
    <Transfer noun="session" getText={() => (mref.current ? exportSession(mref.current) : null)} apply={loadText} /></>;
}

function LibraryView({ p, setP }: { p: P; setP: (f: (x: P) => P) => void }) {
  const [q, setQ] = useState(''), [f, setF] = useState('All'), [bm, setBm] = useState(false);
  const rows = library.filter(c => (f === 'All' || c.shell === f) && (!bm || p.bookmarks.includes(c.name)) && (c.name + c.desc).toLowerCase().includes(q.toLowerCase()));
  const toggle = (n: string) => setP(x => ({ ...x, bookmarks: x.bookmarks.includes(n) ? x.bookmarks.filter(b => b !== n) : [...x.bookmarks, n] }));
  return <><H sub="Works fully offline. Entries cover what the simulator supports.">Command Library</H>
    <div className="mb-6 flex flex-wrap items-center gap-2"><input id="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search commands" aria-label="Search commands" className="w-56 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none" />
      {['All', 'Bash', 'PowerShell', 'CMD'].map(x => <button key={x} onClick={() => setF(x)} className={`btn ${f === x ? 'bg-hl' : ''}`}>{x}</button>)}<button onClick={() => setBm(!bm)} className={`btn ${bm ? 'bg-hl' : ''}`}>Bookmarked</button></div>
    {rows.length === 0 && <p className="text-muted">No matching commands.</p>}
    {rows.map(c => <div key={c.shell + c.name} className="border-t border-line py-4"><div className="flex items-center justify-between"><div><span className="font-mono text-base">{c.name}</span><span className="ml-3 text-xs text-muted">{c.shell}</span></div>
      <button aria-label={`Bookmark ${c.name}`} aria-pressed={p.bookmarks.includes(c.name)} onClick={() => toggle(c.name)}><Star size={16} className="text-accent" fill={p.bookmarks.includes(c.name) ? 'currentColor' : 'none'} /></button></div>
      <p className="mt-1">{c.desc}</p><p className="mt-1 font-mono text-sm text-muted">{c.syntax}</p><p className="mt-2 text-sm text-muted"><span className="text-fg">Windows: </span>{c.win}</p><p className="text-sm text-muted"><span className="text-fg">Watch out: </span>{c.mistake}</p></div>)}</>;
}

function ProgressView({ p }: { p: P }) {
  const cmds = Object.entries(p.commands).sort((a, b) => b[1] - a[1]);
  return <><H sub="Stored locally on this computer.">Progress</H>
    {[['Lessons', p.lessons.filter(l => lessons.some(x => x.id === l)).length, lessons.length], ['Challenges', p.challenges.filter(l => challenges.some(x => x.id === l)).length, challenges.length]].map(([l, a, b]) => <div key={l as string} className="mb-5 max-w-md"><div className="mb-1 flex justify-between text-sm"><span>{l}</span><span className="text-muted">{a} / {b}</span></div><Bar v={(a as number) / (b as number)} /></div>)}
    <p className="mb-8 text-sm text-muted">Time spent learning: {p.minutes} min</p>
    <h2 className="mb-2 font-serif text-xl">Commands practiced</h2>{cmds.length ? <div className="flex flex-wrap gap-2">{cmds.map(([c, n]) => <span key={c} className="rounded-md border border-line px-2 py-1 font-mono text-sm">{c} <span className="text-muted">×{n}</span></span>)}</div> : <p className="text-muted">Run a command in any terminal and it will appear here.</p>}</>;
}

function SettingsView({ s, setS, p, setP, reset }: { s: S; setS: (v: S) => void; p: P; setP: (v: P) => void; reset: () => void }) {
  const [c, setC] = useState(false);
  const Row = ({ l, children }: { l: string; children: React.ReactNode }) => <label className="flex items-center justify-between border-t border-line py-3 text-sm"><span>{l}</span>{children}</label>;
  const Sel = ({ v, o, on }: { v: number; o: number[]; on: (n: number) => void }) => <select value={v} onChange={e => on(Number(e.target.value))} className="rounded-lg border border-line bg-surface px-2 py-1">{o.map(x => <option key={x}>{x}</option>)}</select>;
  const Tog = ({ v, on }: { v: boolean; on: (b: boolean) => void }) => <input type="checkbox" checked={v} onChange={e => on(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />;
  return <><H>Settings</H><h2 className="mb-3 font-serif text-xl">Theme</h2>
    <div className="mb-8 grid grid-cols-3 gap-3">{THEMES.map(([id, name]) => <button key={id} data-theme={id} onClick={() => setS({ ...s, theme: id })} aria-pressed={s.theme === id}
      className="rounded-xl p-3 text-left text-sm" style={{ background: 'var(--bg)', color: 'var(--text)', border: `1px solid ${s.theme === id ? 'var(--accent)' : 'var(--border)'}` }}>{name}
      <div className="mt-2 flex gap-1"><i className="h-3 w-6 rounded" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} /><i className="h-3 w-6 rounded" style={{ background: 'var(--accent)' }} /><i className="h-3 w-6 rounded" style={{ background: 'var(--tbg)' }} /></div></button>)}</div>
    <h2 className="mb-1 font-serif text-xl">Appearance & learning</h2>
    <Row l="Interface font size"><Sel v={s.fontSize} o={[14, 15, 16, 17, 18]} on={n => setS({ ...s, fontSize: n })} /></Row>
    <Row l="Terminal font size"><Sel v={s.termSize} o={[12, 13, 14, 15, 16]} on={n => setS({ ...s, termSize: n })} /></Row>
    <Row l="Reduce motion"><Tog v={s.reduceMotion} on={b => setS({ ...s, reduceMotion: b })} /></Row>
    <Row l="Show Windows comparisons in lessons"><Tog v={s.showWin} on={b => setS({ ...s, showWin: b })} /></Row>
    <div className="mt-8 border-t border-line pt-4"><h2 className="mb-2 font-serif text-xl">Data</h2><p className="mb-3 text-sm text-muted">Settings and progress live in a local SQLite database. Nothing is sent anywhere. Importing replaces your current settings and progress.</p>
      <Transfer noun="backup" getText={() => makeBackup(s, p)} apply={t => { const r = parseBackup(t); if ('error' in r) return r.error; setS(r.settings); setP(r.progress); return 'Backup imported.'; }} />
      <div className="mt-4"></div>
      {c ? <span className="flex items-center gap-2 text-sm">Erase all settings and progress? <button className="btn btn-primary" onClick={() => { reset(); setC(false); }}>Yes, erase</button><button className="btn" onClick={() => setC(false)}>Cancel</button></span>
        : <button className="btn" onClick={() => setC(true)}>Reset all data…</button>}</div></>;
}
