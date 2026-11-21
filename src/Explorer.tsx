import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, Folder, FileText, FolderPlus, FilePlus } from 'lucide-react';
import { Machine } from './machine';
import { Action, validName } from './translate';

type Dlg = null | { t: 'name'; title: string; init: string; go: (v: string) => string | null } | { t: 'del' } | { t: 'edit'; name: string } | { t: 'props'; name: string } | { t: 'err'; msg: string };

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.35)' }} onMouseDown={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()} className="w-[26rem] max-w-[92vw] rounded-xl border border-line bg-bg p-5"><h3 className="mb-3 font-serif text-lg">{title}</h3>{children}</div></div>;
}
function NameDialog({ d, close }: { d: Extract<Dlg, { t: 'name' }>; close: () => void }) {
  const [v, setV] = useState(d.init), [e, setE] = useState<string | null>(null);
  return <Dialog title={d.title} onClose={close}><form onSubmit={ev => { ev.preventDefault(); const r = d.go(v); if (r) setE(r); else close(); }}>
    <input autoFocus value={v} onChange={x => setV(x.target.value)} onFocus={x => x.target.select()} aria-label="Name" className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 outline-none" />
    {e && <p role="alert" className="mt-2 text-sm" style={{ color: 'var(--err)' }}>{e}</p>}
    <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn btn-primary">OK</button></div></form></Dialog>;
}
function EditDialog({ m, name, act, close }: { m: Machine; name: string; act: (a: Action) => string | null; close: () => void }) {
  const r = m.read(name), [t, setT] = useState(typeof r === 'string' && !['ENOENT', 'EISDIR'].includes(r) ? r.replace(/\n$/, '') : ''), [e, setE] = useState<string | null>(null);
  return <Dialog title={name} onClose={close}><textarea autoFocus value={t} onChange={x => setT(x.target.value)} aria-label="File contents" rows={8} className="w-full rounded-lg border border-line bg-surface p-2 font-mono text-sm outline-none" />
    {e && <p role="alert" className="mt-2 text-sm" style={{ color: 'var(--err)' }}>{e}</p>}
    <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={() => { const x = act({ k: 'write', name, text: t }); if (x) setE(x); else close(); }}>Save</button></div></Dialog>;
}

export function Explorer({ m, act }: { m: Machine; tick: number; act: (a: Action) => string | null }) {
  const [sel, setSel] = useState<string[]>([]), [dlg, setDlg] = useState<Dlg>(null), [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [clip, setClip] = useState<{ paths: { p: string; dir: boolean; n: string }[]; cut: boolean } | null>(null);
  const hist = useRef({ st: [[...m.cwd]], i: 0 }), H = hist.current, cur = m.fmt();
  if (m.fmt(H.st[H.i]) !== cur) { H.st = H.st.slice(0, H.i + 1); H.st.push([...m.cwd]); H.i++; }
  useEffect(() => { const c = () => setMenu(null); window.addEventListener('click', c); return () => window.removeEventListener('click', c); }, []);
  const l = m.list('.'), items = (Array.isArray(l) ? l : []).sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
  const names = items.map(i => i.name), selected = sel.filter(s => names.includes(s));
  const fail = (msg: string) => setDlg({ t: 'err', msg });
  const go = (a: Action) => { const e = act(a); if (e) fail(e); return !e; };
  const exists = (n: string) => m.lookup([...m.cwd, n]) !== undefined;
  const uniq = (b: string, e = '') => { let n = b + e, i = 2; while (exists(n)) n = `${b} (${i++})${e}`; return n; };
  const check = (n: string) => validName(m.flavor, n) ?? (exists(n) ? 'An item with that name already exists.' : null);
  const open = (n: string) => items.find(i => i.name === n)?.dir ? go({ k: 'cd', path: n }) : setDlg({ t: 'edit', name: n });
  const nav = (i: number) => { if (i < 0 || i >= H.st.length) return; const old = H.i; H.i = i; if (!go({ k: 'cd', path: m.fmt(H.st[i]) })) H.i = old; };
  const mkNew = (dir: boolean) => setDlg({ t: 'name', title: dir ? 'New folder' : 'New file', init: dir ? uniq('New folder') : uniq('New file', '.txt'), go: v => check(v) ?? act({ k: dir ? 'mkdir' : 'newfile', name: v }) });
  const rename = () => selected.length === 1 && setDlg({ t: 'name', title: 'Rename', init: selected[0], go: v => v === selected[0] ? null : check(v) ?? act({ k: 'rename', from: selected[0], to: v }) });
  const copy = (cut: boolean) => selected.length && setClip({ cut, paths: selected.map(n => ({ n, p: m.fmt([...m.cwd, n]), dir: items.find(i => i.name === n)!.dir })) });
  const paste = () => {
    if (!clip) return;
    for (const c of clip.paths) {
      const src = m.lookup(m.resolve(c.p)); if (!src) { fail(`${c.n} no longer exists.`); continue; }
      const sameDir = m.fmt(m.resolve(c.p).slice(0, -1)) === cur;
      if (clip.cut) { if (sameDir) continue; if (exists(c.n)) { fail(`${c.n} already exists here; nothing was overwritten.`); continue; } if (!go({ k: 'move', from: c.p, to: '.' })) break; }
      else if (sameDir) { const n = uniq(c.n.replace(/(\.[^.]*)?$/, ' - Copy$1')); if (!go({ k: 'copy', from: c.n, to: n, dir: c.dir })) break; }
      else { if (exists(c.n)) { fail(`${c.n} already exists here; nothing was overwritten.`); continue; } if (!go({ k: 'copy', from: c.p, to: '.', dir: c.dir })) break; }
    }
    if (clip.cut) setClip(null);
  };
  const del = () => { for (const n of selected) if (!go({ k: 'delete', name: n, dir: !!items.find(i => i.name === n)?.dir })) break; setSel([]); };
  const key = (e: React.KeyboardEvent) => {
    if (dlg) return; const c = e.ctrlKey && e.key.toLowerCase();
    if (e.key === 'F2') rename(); else if (e.key === 'Delete' && selected.length) setDlg({ t: 'del' }); else if (c === 'c') copy(false); else if (c === 'x') copy(true); else if (c === 'v') paste();
    else if (c === 'a') { e.preventDefault(); setSel(names); } else if (e.key === 'Enter' && selected.length === 1) open(selected[0]); else if (e.key === 'Backspace') go({ k: 'cd', path: '..' }); else return;
    e.preventDefault();
  };
  const click = (n: string, e: React.MouseEvent) => setSel(e.ctrlKey ? (selected.includes(n) ? selected.filter(x => x !== n) : [...selected, n]) : [n]);
  const drop = (target: string, e: React.DragEvent) => { e.preventDefault(); let a: string[] = []; try { a = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; } for (const n of a) if (n !== target && !go({ k: 'move', from: n, to: target })) break; };
  const crumbs = m.cwd.map((s, i) => [s, m.fmt(m.cwd.slice(0, i + 1))] as const);
  const node = (n: string) => m.lookup([...m.cwd, n]);
  const Item = ({ label, on, off }: { label: string; on: () => void; off?: boolean }) => <button disabled={off} onClick={on} className="block w-full rounded px-3 py-1 text-left text-sm hover:bg-hl disabled:opacity-40">{label}</button>;
  return <div className="flex h-72 flex-col overflow-hidden rounded-xl border border-line bg-surface">
    <div className="flex items-center gap-1 border-b border-line p-2">
      <button className="btn" aria-label="Back" disabled={H.i === 0} onClick={() => nav(H.i - 1)}><ArrowLeft size={14} /></button>
      <button className="btn" aria-label="Forward" disabled={H.i >= H.st.length - 1} onClick={() => nav(H.i + 1)}><ArrowRight size={14} /></button>
      <button className="btn" aria-label="Up one folder" onClick={() => go({ k: 'cd', path: '..' })}><ArrowUp size={14} /></button>
      <input key={cur} defaultValue={cur} aria-label="Address bar" spellCheck={false} onKeyDown={e => { if (e.key === 'Enter') go({ k: 'cd', path: e.currentTarget.value }); }} className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2 py-1 font-mono text-xs outline-none" />
      <button className="btn" aria-label="New folder" title="New folder" onClick={() => mkNew(true)}><FolderPlus size={14} /></button>
      <button className="btn" aria-label="New file" title="New file" onClick={() => mkNew(false)}><FilePlus size={14} /></button></div>
    <nav aria-label="Breadcrumb" className="flex gap-1 overflow-x-auto border-b border-line px-2 py-1 text-xs text-muted">{crumbs.map(([s, p], i) => <span key={p} className="flex shrink-0 items-center gap-1">{i > 0 && '›'}<button className="hover:text-fg" onClick={() => go({ k: 'cd', path: p })}>{s}</button></span>)}</nav>
    <div role="listbox" aria-multiselectable="true" aria-label="Files" tabIndex={0} onKeyDown={key} onClick={e => e.target === e.currentTarget && setSel([])}
      onContextMenu={e => { e.preventDefault(); if (e.target === e.currentTarget) setSel([]); setMenu({ x: e.clientX, y: e.clientY }); }} className="flex-1 overflow-auto p-2 outline-none">
      {items.length === 0 && <p className="p-2 text-sm text-muted">{Array.isArray(l) ? 'This folder is empty.' : 'This folder no longer exists. Use Up.'}</p>}
      {items.map(i => <div key={i.name} role="option" aria-selected={selected.includes(i.name)} draggable onClick={e => click(i.name, e)} onDoubleClick={() => open(i.name)}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); if (!selected.includes(i.name)) setSel([i.name]); setMenu({ x: e.clientX, y: e.clientY }); }}
        onDragStart={e => { e.dataTransfer.setData('text/plain', JSON.stringify(selected.includes(i.name) ? selected : [i.name])); }}
        onDragOver={e => i.dir && e.preventDefault()} onDrop={e => i.dir && drop(i.name, e)}
        className={`row-in flex cursor-default items-center gap-2 rounded px-2 py-1 text-sm ${selected.includes(i.name) ? 'bg-hl' : ''} ${clip?.cut && clip.paths.some(c => c.n === i.name && c.p === m.fmt([...m.cwd, i.name])) ? 'opacity-50' : ''}`}>
        {i.dir ? <Folder size={14} className="text-accent" /> : <FileText size={14} className="text-muted" />}<span className="truncate">{i.name}</span></div>)}</div>
    {menu && <div role="menu" className="fixed z-40 w-44 rounded-lg border border-line bg-bg p-1 shadow" style={{ left: menu.x, top: menu.y }} onClick={() => setMenu(null)}>
      {selected.length === 1 && <Item label="Open" on={() => open(selected[0])} />}<Item label="New folder" on={() => mkNew(true)} /><Item label="New file" on={() => mkNew(false)} />
      <Item label="Rename (F2)" off={selected.length !== 1} on={rename} /><Item label="Copy" off={!selected.length} on={() => copy(false)} /><Item label="Cut" off={!selected.length} on={() => copy(true)} />
      <Item label="Paste" off={!clip} on={paste} /><Item label="Delete" off={!selected.length} on={() => setDlg({ t: 'del' })} /><Item label="Properties" off={selected.length !== 1} on={() => setDlg({ t: 'props', name: selected[0] })} /></div>}
    {dlg?.t === 'name' && <NameDialog d={dlg} close={() => setDlg(null)} />}
    {dlg?.t === 'edit' && <EditDialog m={m} name={dlg.name} act={act} close={() => setDlg(null)} />}
    {dlg?.t === 'err' && <Dialog title="That didn’t work" onClose={() => setDlg(null)}><p role="alert" className="text-sm">{dlg.msg}</p><div className="mt-4 flex justify-end"><button autoFocus className="btn btn-primary" onClick={() => setDlg(null)}>OK</button></div></Dialog>}
    {dlg?.t === 'del' && <Dialog title="Delete permanently?" onClose={() => setDlg(null)}><p className="text-sm text-muted">{selected.join(', ')}</p><p className="mt-2 text-sm">Simulated deletion has no Recycle Bin, just like the shell command.</p>
      <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={() => setDlg(null)}>Cancel</button><button autoFocus className="btn btn-primary" onClick={() => { setDlg(null); del(); }}>Delete</button></div></Dialog>}
    {dlg?.t === 'props' && (() => { const n = node(dlg.name); return <Dialog title="Properties" onClose={() => setDlg(null)}><dl className="space-y-1 text-sm"><div><dt className="inline text-muted">Name: </dt><dd className="inline">{dlg.name}</dd></div>
      <div><dt className="inline text-muted">Location: </dt><dd className="inline font-mono">{cur}</dd></div><div><dt className="inline text-muted">Type: </dt><dd className="inline">{n?.t === 'd' ? 'Folder' : 'File'}</dd></div>
      <div><dt className="inline text-muted">{n?.t === 'd' ? 'Contains: ' : 'Size: '}</dt><dd className="inline">{n?.t === 'd' ? `${n.c.size} item(s)` : `${n?.t === 'f' ? n.data.length : 0} character(s)`}</dd></div></dl>
      <div className="mt-4 flex justify-end"><button autoFocus className="btn btn-primary" onClick={() => setDlg(null)}>Close</button></div></Dialog>; })()}
  </div>;
}
