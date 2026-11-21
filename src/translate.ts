// GUI action -> shell command. Quoting is shell-specific; anything that cannot be written
// safely is refused (cmd = null) instead of producing a wrong command.
import { Flavor } from './machine';
export type Action =
  | { k: 'mkdir'; name: string } | { k: 'newfile'; name: string } | { k: 'rename'; from: string; to: string }
  | { k: 'delete'; name: string; dir: boolean } | { k: 'copy'; from: string; to: string; dir: boolean }
  | { k: 'move'; from: string; to: string } | { k: 'cd'; path: string } | { k: 'write'; name: string; text: string };
export interface Tr { cmd: string | null; explain: string; result: string; error?: string }
export const SHELL_NAME: Record<Flavor, string> = { bash: 'Bash', ps: 'PowerShell', cmd: 'CMD' };

export function validName(fl: Flavor, n: string): string | null {
  if (!n.trim()) return 'Name cannot be empty.';
  if (n === '.' || n === '..') return 'That name is reserved.';
  if (n.length > 255) return 'Name is too long.';
  if (n.includes('/') || n.includes('\0')) return 'Names cannot contain "/".';
  if (fl !== 'bash') {
    if (/[\\:*?"<>|]/.test(n)) return 'Windows names cannot contain \\ : * ? " < > |';
    if (/[. ]$/.test(n)) return 'Windows names cannot end with a dot or space.';
    if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(n)) return 'That is a reserved Windows device name.';
  }
  return null;
}

/** Quote one argument for the given shell; null if it cannot be represented safely. */
export function q(fl: Flavor, s: string): string | null {
  if (s === '' || s.includes('\0') || /[\r\n]/.test(s)) return null;
  if (fl === 'cmd') {
    if (s.includes('"')) return null;
    return /^[^\s&|<>^%()]+$/.test(s) ? s : `"${s}"`;
  }
  if (s.startsWith('-')) s = './' + s;
  if (/^[\w.,:@%+=\/-]+$/.test(s)) return s;
  if (!s.includes("'")) return `'${s}'`;
  if (!s.includes('"') && !/[$`\\!]/.test(s)) return `"${s}"`;
  return null;
}

export function translate(fl: Flavor, a: Action): Tr {
  const bad = (x: string): Tr => ({ cmd: null, explain: '', result: '', error: `“${x}” cannot be written as a safe ${SHELL_NAME[fl]} command (unsupported quote or control characters). Choose a simpler name.` });
  const A = (s: string) => q(fl, s);
  const win = fl !== 'bash';
  switch (a.k) {
    case 'mkdir': { const n = A(a.name); if (!n) return bad(a.name);
      return { cmd: fl === 'ps' ? `New-Item -ItemType Directory -Name ${n}` : `mkdir ${n}`, explain: 'Creates a new, empty folder in the current directory.', result: `A folder named ${a.name} appears here.` }; }
    case 'newfile': { const n = A(a.name); if (!n) return bad(a.name);
      return { cmd: fl === 'bash' ? `touch ${n}` : fl === 'ps' ? `New-Item -ItemType File -Name ${n}` : `type nul > ${n}`, explain: fl === 'cmd' ? 'CMD has no touch; reading the empty device "nul" and redirecting it with > creates an empty file.' : 'Creates a new empty file in the current directory.', result: `An empty file named ${a.name} appears here.` }; }
    case 'rename': { const x = A(a.from), y = A(a.to); if (!x) return bad(a.from); if (!y) return bad(a.to);
      return { cmd: fl === 'bash' ? `mv ${x} ${y}` : fl === 'ps' ? `Rename-Item ${x} ${y}` : `ren ${x} ${y}`, explain: fl === 'bash' ? 'Linux has no rename command; mv "moves" the item to a new name in the same place.' : 'Changes the item\'s name without moving it.', result: `${a.from} is now called ${a.to}.` }; }
    case 'delete': { const n = A(a.name); if (!n) return bad(a.name);
      const cmd = fl === 'bash' ? `rm ${a.dir ? '-r ' : ''}${n}` : fl === 'ps' ? `Remove-Item ${n}${a.dir ? ' -Recurse' : ''}` : a.dir ? `rd /s ${n}` : `del ${n}`;
      return { cmd, explain: `Permanently deletes ${a.dir ? 'the folder and everything inside it' : 'the file'}. This is like Shift+Delete in File Explorer: there is no Recycle Bin.`, result: `${a.name} is gone.` }; }
    case 'copy': { const x = A(a.from), y = A(a.to); if (!x) return bad(a.from); if (!y) return bad(a.to);
      if (fl === 'cmd' && a.dir) return { cmd: null, explain: 'CMD\'s copy only handles files. Real Windows copies folders with xcopy or robocopy, which this simulator does not model.', result: '', error: 'Copying a folder is not available in CMD mode here. Switch to Bash or PowerShell for this action.' };
      return { cmd: fl === 'bash' ? `cp ${a.dir ? '-r ' : ''}${x} ${y}` : fl === 'ps' ? `Copy-Item ${x} ${y}${a.dir ? ' -Recurse' : ''}` : `copy ${x} ${y}`, explain: `Duplicates ${a.dir ? 'the folder and its contents' : 'the file'}; the original stays where it is.${a.dir && fl === 'bash' ? ' -r means recursive: include everything inside.' : ''}`, result: `A copy exists at ${a.to}.` }; }
    case 'move': { const x = A(a.from), y = A(a.to); if (!x) return bad(a.from); if (!y) return bad(a.to);
      return { cmd: fl === 'bash' ? `mv ${x} ${y}` : fl === 'ps' ? `Move-Item ${x} ${y}` : `move ${x} ${y}`, explain: 'Moves the item. Unlike copy, it no longer exists at the old location.', result: `${a.from} now lives at ${a.to}.` }; }
    case 'cd': { const p = A(a.path); if (!p) return bad(a.path);
      return { cmd: fl === 'ps' ? `Set-Location ${p}` : `cd ${p}`, explain: 'Changes the shell\'s current working directory — the same as opening that folder in File Explorer.', result: `The prompt now shows the new location.` }; }
    case 'write': {
      if (/[\r\n]/.test(a.text)) return { cmd: null, explain: 'Multi-line files are normally edited in a text editor (nano or vim on Linux, Notepad on Windows); a single shell command cannot express that cleanly. The file was saved directly.', result: `${a.name} now holds the new text.` };
      const n = A(a.name); if (!n) return bad(a.name);
      if (a.text === '') return translate(fl, { k: 'newfile', name: a.name });
      const t = win && fl === 'cmd' ? (/^[\w .,!?-]+$/.test(a.text) ? a.text : null) : A(a.text);
      if (t === null) return { cmd: null, explain: 'This text has characters that CMD\'s echo cannot reproduce safely, so no single command is shown. The file was saved directly.', result: `${a.name} now holds the new text.` };
      return { cmd: `echo ${t} > ${n}`, explain: 'echo prints text; > redirects that output into the file, replacing its previous contents.', result: `${a.name} contains the text.` }; }
  }
}
