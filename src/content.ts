import { Machine, Flavor } from './machine';
export const homeOf = (m: Machine) => (m.win ? ['C:', 'Users', 'user'] : ['home', 'user']);
const at = (m: Machine, ...p: string[]) => m.lookup([...homeOf(m), ...p]);
const inDir = (m: Machine, ...p: string[]) => { const a = m.cwd.join('/'), b = [...homeOf(m), ...p].join('/'); return m.win ? a.toLowerCase() === b.toLowerCase() : a === b; };

export interface Step { title: string; concept: string; windows: string; goal: string; cmds: Record<Flavor | 'gui', string>; note: string; why: string; check: (m: Machine) => boolean }
const first = { id: 'first-folder', module: 'Module 1 · Terminal fundamentals', title: 'Your first folder and file', blurb: 'Make a folder, step inside it, and create a file — in all three shells.', steps: [
  { title: 'Make a folder', concept: 'A folder (directory) is a container for files. In a terminal you create one with a command instead of a right-click.',
    windows: 'In File Explorer: right-click an empty area → New → Folder → type the name study.', goal: 'Create a folder named study.',
    cmds: { bash: 'mkdir study', ps: 'mkdir study', cmd: 'mkdir study', gui: 'Right-click → New → Folder' },
    note: 'All three shells use the name mkdir here, but PowerShell\'s mkdir is a wrapper around New-Item and returns an object, while Bash and CMD print nothing.',
    why: 'The shell asked the filesystem to add a directory entry named study inside your current folder. Nothing else moved.', check: m => at(m, 'study')?.t === 'd' },
  { title: 'Step inside it', concept: 'Every shell has a current working directory. Relative names like study are looked up from there; cd changes it.',
    windows: 'In File Explorer: double-click the study folder. The address bar now ends in \\study.', goal: 'Move into the study folder.',
    cmds: { bash: 'cd study', ps: 'cd study   (Set-Location study)', cmd: 'cd study', gui: 'Double-click the folder' },
    note: 'The prompt shows where you are. Linux paths use / and are case-sensitive (Study ≠ study); Windows paths use \\ and ignore case.',
    why: 'Only the shell\'s idea of "here" changed — no files were touched. Later commands now start from study.', check: m => inDir(m, 'study') },
  { title: 'Create a file', concept: 'Files hold data. An empty file is the simplest thing you can create.',
    windows: 'In File Explorer: right-click → New → Text Document → name it notes.txt.', goal: 'Create notes.txt, then list the folder to see it.',
    cmds: { bash: 'touch notes.txt', ps: 'New-Item notes.txt', cmd: 'type nul > notes.txt', gui: 'Right-click → New → Text Document' },
    note: 'These are not identical: touch also updates the timestamp of an existing file, while New-Item errors if the file exists. In CMD there is no touch; type nul > file is the usual idiom.',
    why: 'The shell created a new empty file inside the current directory. ls / dir / Get-ChildItem read that directory back to you.', check: m => at(m, 'study', 'notes.txt')?.t === 'f' }] as Step[] };

export interface Lesson { id: string; module: string; title: string; blurb: string; seed?: (m: Machine) => void; steps: Step[] }
type Cm = Record<Flavor | 'gui', string>;
const S = (title: string, concept: string, windows: string, goal: string, cmds: Cm, note: string, why: string, check: (m: Machine) => boolean): Step => ({ title, concept, windows, goal, cmds, note, why, check });
const seedPaths = (m: Machine) => { m.mkdir('projects/web/src', true); };
const seedCopy = (m: Machine) => { m.write('notes.txt', 'my notes'); m.mkdir('archive'); };
const data = (m: Machine, ...p: string[]) => { const n = at(m, ...p); return n?.t === 'f' ? n.data : undefined; };
const M1 = 'Module 1 · Terminal fundamentals', M2 = 'Module 2 · File management', M3 = 'Module 3 · Shell differences';
export const lessons: Lesson[] = [first,
  { id: 'paths', module: M1, title: 'Relative and absolute paths', blurb: 'Move around a folder tree using short (relative) and full (absolute) paths.', seed: seedPaths, steps: [
    S('Go deep with a relative path', 'A relative path starts from where you are now. projects/web/src means: from here, enter projects, then web, then src.', 'In File Explorer: double-click projects, then web, then src — three clicks, one path.', 'Move into projects/web/src in a single command.',
      { bash: 'cd projects/web/src', ps: 'cd projects/web/src', cmd: 'cd projects\\web\\src', gui: 'Double-click through each folder' }, 'Linux separates folders with /; Windows uses \\ (PowerShell accepts both).', 'The shell followed each name from your current folder. No names were guessed.', m => inDir(m, 'projects', 'web', 'src')),
    S('Climb back up with ..', '.. always means "the folder that contains this one". Chain two of them to climb two levels.', 'In File Explorer: the Up arrow next to the address bar.', 'Go up twice so you are in projects.',
      { bash: 'cd ..', ps: 'cd ..', cmd: 'cd ..', gui: 'Click the Up arrow twice' }, 'Run cd .. once per level. (cd ../.. also works in Bash and PowerShell.)', '.. is a real entry in every folder pointing at its parent, so it works the same everywhere.', m => inDir(m, 'projects')),
    S('Jump home with an absolute path', 'An absolute path starts at the very top (/ on Linux, a drive letter on Windows), so it works from anywhere.', 'In File Explorer: type a full path such as C:\\Users\\user in the address bar.', 'Go to your home folder using its full path.',
      { bash: 'cd /home/user', ps: 'cd C:\\Users\\user', cmd: 'cd C:\\Users\\user', gui: 'Type the full path in the address bar' }, 'Linux has one tree starting at /. Windows has one tree per drive (C:\\, D:\\ …).', 'An absolute path ignores where you are; that is its whole point.', m => inDir(m)) ] },
  { id: 'copy-move', module: M2, title: 'Copy, rename and delete', blurb: 'Duplicate a file, give it a new name, and remove the duplicate.', seed: seedCopy, steps: [
    S('Copy a file', 'Copying makes a second, independent file. The original stays.', 'Select notes.txt → Ctrl+C → open archive → Ctrl+V.', 'Copy notes.txt into the archive folder.',
      { bash: 'cp notes.txt archive', ps: 'Copy-Item notes.txt archive', cmd: 'copy notes.txt archive', gui: 'Ctrl+C, then Ctrl+V in archive' }, 'cp, Copy-Item and copy are close but not identical: for folders cp needs -r, Copy-Item needs -Recurse, and CMD copy cannot copy folders at all.', 'The shell read the file and wrote a new one with the same name inside archive.', m => data(m, 'notes.txt') !== undefined && data(m, 'archive', 'notes.txt') === 'my notes'),
    S('Rename a file', 'Renaming changes only the name; the contents stay.', 'Select the file → F2 → type the new name.', 'Rename notes.txt to todo.txt.',
      { bash: 'mv notes.txt todo.txt', ps: 'Rename-Item notes.txt todo.txt', cmd: 'ren notes.txt todo.txt', gui: 'F2, type the name, Enter' }, 'Linux has no rename command: mv moves the item to a new name. mv silently overwrites an existing todo.txt; Rename-Item and ren refuse.', 'The item kept its place; only its entry in the folder changed.', m => data(m, 'todo.txt') === 'my notes' && at(m, 'notes.txt') === undefined),
    S('Delete the duplicate', 'Deleting in a shell is permanent — there is no Recycle Bin.', 'Select the file → Shift+Delete (the permanent kind).', 'Delete the copy inside archive, keeping todo.txt.',
      { bash: 'rm archive/notes.txt', ps: 'Remove-Item archive/notes.txt', cmd: 'del archive\\notes.txt', gui: 'Shift+Delete' }, 'Check the path twice before pressing Enter; there is no undo.', 'The entry was removed from archive. todo.txt was untouched.', m => at(m, 'archive', 'notes.txt') === undefined && at(m, 'todo.txt') !== undefined)] },
  { id: 'text-files', module: M2, title: 'Writing text with redirection', blurb: 'Put text into a file with > and add to it with >>.', steps: [
    S('Write a file with >', 'The > symbol sends a command\'s output into a file instead of the screen, replacing what was there.', 'Open Notepad, type hello, save as hello.txt.', 'Create hello.txt containing the word hello.',
      { bash: 'echo hello > hello.txt', ps: 'echo hello > hello.txt', cmd: 'echo hello > hello.txt', gui: 'Notepad → Save As' }, 'In real Windows PowerShell 5, > writes UTF-16; PowerShell 7 uses UTF-8. The simulator does not model encodings.', 'echo produced the text, and > redirected it into the file, creating it.', m => data(m, 'hello.txt')?.trim() === 'hello'),
    S('Add a line with >>', '>> appends instead of replacing.', 'Open the file, go to the end, type a new line, save.', 'Append the word world as a second line.',
      { bash: 'echo world >> hello.txt', ps: 'echo world >> hello.txt', cmd: 'echo world >> hello.txt', gui: 'Open, type at the end, Ctrl+S' }, 'Using > by mistake would erase hello — the most common redirection error.', 'The file now has both lines because >> adds to the end.', m => JSON.stringify(data(m, 'hello.txt')?.trim().split('\n')) === '["hello","world"]')] },
  { id: 'quoting', module: M3, title: 'Names with spaces: quoting', blurb: 'Why "my notes" needs quotes, and what happens without them.', steps: [
    S('Create a folder with a space', 'A shell splits commands on spaces. Without quotes, mkdir my notes would make two folders: my and notes.', 'File Explorer lets you type spaces freely — it never needs quotes.', 'Create one folder named my notes.',
      { bash: 'mkdir "my notes"', ps: 'mkdir "my notes"', cmd: 'mkdir "my notes"', gui: 'New → Folder → type my notes' }, 'Bash and PowerShell accept single or double quotes (double quotes also expand variables). CMD only understands double quotes.', 'The quotes told the shell "this is one argument".', m => at(m, 'my notes')?.t === 'd' && at(m, 'my') === undefined),
    S('Step inside', 'Quotes are needed every time the name is used.', 'Double-click the folder.', 'Enter my notes.',
      { bash: 'cd "my notes"', ps: 'cd "my notes"', cmd: 'cd "my notes"', gui: 'Double-click' }, 'Tab completion adds the quoting or escaping for you in real shells.', 'The shell looked for one folder with the full name.', m => inDir(m, 'my notes')),
    S('Create a file with a space', 'The same rule applies to files.', 'Right-click → New → Text Document → name it a b.txt.', 'Create a b.txt here.',
      { bash: 'touch "a b.txt"', ps: 'New-Item "a b.txt"', cmd: 'type nul > "a b.txt"', gui: 'New → Text Document' }, 'Avoiding spaces in names is a common habit because it removes this whole class of mistakes.', 'One quoted argument became one file.', m => at(m, 'my notes', 'a b.txt')?.t === 'f')] },
];

export interface Challenge { id: string; title: string; task: string; level: string; seed?: (m: Machine) => void; check: (m: Machine) => boolean; hints: string[] }
const seedOld = (m: Machine) => { m.write('old.txt', 'x'); };
const seedMess = (m: Machine) => { for (const f of ['a.txt', 'b.txt', 'photo1.jpg', 'photo2.jpg']) m.write(f, f); };
const seedProj = (m: Machine) => { m.mkdir('project/src', true); m.write('project/src/main.txt', 'print'); m.write('project/notes.txt', 'todo'); };
export const challenges: Challenge[] = [
  { id: 'c1', level: 'Easy', title: 'Folder, file, inside', task: 'Create a folder named projects, enter it, and create a file called notes.txt there.',
    check: m => inDir(m, 'projects') && at(m, 'projects', 'notes.txt')?.t === 'f', hints: ['You need three actions: make, enter, create.', 'mkdir makes the folder; cd enters it.', 'Bash: touch notes.txt · PowerShell: New-Item notes.txt · CMD: type nul > notes.txt'] },
  { id: 'c4', level: 'Easy', title: 'Folder hierarchy', task: 'Build the folders a/b/c and put a file named readme.md inside c.',
    check: m => at(m, 'a', 'b', 'c', 'readme.md')?.t === 'f', hints: ['Parents must exist before children — or ask for them to be created.', 'Bash: mkdir -p a/b/c. PowerShell and CMD create parents automatically.', 'Then cd a/b/c (CMD: a\\b\\c) and create the file, or give the file its full path.'] },
  { id: 'c5', level: 'Easy', title: 'Give it a better name', task: 'old.txt exists. Rename it to new.txt.', seed: seedOld,
    check: m => at(m, 'new.txt')?.t === 'f' && at(m, 'old.txt') === undefined, hints: ['Renaming keeps the contents.', 'Bash uses mv; PowerShell Rename-Item; CMD ren.', 'mv old.txt new.txt'] },
  { id: 'c6', level: 'Medium', title: 'Write a note', task: 'Create note.txt containing exactly the word hello.',
    check: m => data(m, 'note.txt')?.trim() === 'hello', hints: ['Redirection puts output into a file.', 'echo prints text.', 'echo hello > note.txt'] },
  { id: 'c2', level: 'Medium', title: 'Back it up', task: 'notes.txt already exists. Copy it into a new folder named backup, keeping the original in place.',
    seed: m => { m.write('notes.txt', 'my notes'); },
    check: m => data(m, 'notes.txt') === 'my notes' && data(m, 'backup', 'notes.txt') === 'my notes', hints: ['Create the folder first.', 'cp (Bash/PowerShell) or copy (CMD) duplicates a file.', 'cp notes.txt backup  — copying into a folder keeps the file name.'] },
  { id: 'c3', level: 'Medium', title: 'File it away', task: 'Move draft.txt into the archive folder. Afterwards draft.txt should no longer be in your home folder.',
    seed: m => { m.write('draft.txt', 'v1'); m.mkdir('archive'); },
    check: m => at(m, 'draft.txt') === undefined && at(m, 'archive', 'draft.txt')?.t === 'f', hints: ['Moving is copying plus deleting the original.', 'mv (Bash/PowerShell) or move (CMD).', 'mv draft.txt archive'] },
  { id: 'c7', level: 'Hard', title: 'Tidy a messy folder', task: 'Make folders docs and images. Move the two .txt files into docs and the two .jpg files into images.', seed: seedMess,
    check: m => ['a.txt', 'b.txt'].every(f => at(m, 'docs', f)) && ['photo1.jpg', 'photo2.jpg'].every(f => at(m, 'images', f)) && ['a.txt', 'b.txt', 'photo1.jpg', 'photo2.jpg'].every(f => !at(m, f)), hints: ['Four moves and two new folders.', 'Wildcards (*.txt) are not supported in the simulator — move each file.', 'mkdir docs, mkdir images, then mv a.txt docs …'] },
  { id: 'c8', level: 'Hard', title: 'A complete backup', task: 'Make a full copy of the folder project named project-backup (including everything inside) and leave project untouched.', seed: seedProj,
    check: m => data(m, 'project-backup', 'src', 'main.txt') === 'print' && data(m, 'project-backup', 'notes.txt') === 'todo' && data(m, 'project', 'src', 'main.txt') === 'print', hints: ['A folder copy must include its contents.', 'Bash: cp -r. PowerShell: Copy-Item -Recurse. CMD cannot copy folders with copy.', 'In CMD: md project-backup\\src, then copy each file into place.'] }];

export interface Cmd { name: string; shell: string; desc: string; syntax: string; win: string; mistake: string }
export const library: Cmd[] = [
  { name: 'pwd', shell: 'Bash', desc: 'Print the current working directory.', syntax: 'pwd', win: 'The address bar in File Explorer. PowerShell: Get-Location. CMD: cd with no arguments.', mistake: 'Expecting a drive letter — Linux has one tree starting at /.' },
  { name: 'ls', shell: 'Bash', desc: 'List directory contents.', syntax: 'ls [-a] [path]', win: 'Looking inside a folder in File Explorer. PowerShell: Get-ChildItem. CMD: dir.', mistake: 'Forgetting -a: names starting with . are hidden by default.' },
  { name: 'cd', shell: 'Bash', desc: 'Change the current directory.', syntax: 'cd [path]   (cd alone goes home)', win: 'Double-clicking folders or typing a path in the address bar.', mistake: 'Case: "cd docs" will not find "Docs" on Linux.' },
  { name: 'mkdir', shell: 'Bash', desc: 'Create a directory.', syntax: 'mkdir [-p] name…', win: 'Right-click → New → Folder.', mistake: 'mkdir a/b fails if a does not exist; add -p to create parents.' },
  { name: 'touch', shell: 'Bash', desc: 'Create an empty file (or update its timestamp).', syntax: 'touch name…', win: 'Right-click → New → Text Document.', mistake: 'Assuming it empties an existing file — it does not.' },
  { name: 'cat', shell: 'Bash', desc: 'Print a file\'s contents.', syntax: 'cat file…', win: 'Opening a file in Notepad. PowerShell: Get-Content. CMD: type.', mistake: 'Running it on a folder: it reports "Is a directory".' },
  { name: 'cp', shell: 'Bash', desc: 'Copy files or folders.', syntax: 'cp [-r] source dest', win: 'Ctrl+C then Ctrl+V in File Explorer.', mistake: 'Copying a folder without -r.' },
  { name: 'mv', shell: 'Bash', desc: 'Move or rename.', syntax: 'mv source dest', win: 'Drag and drop, or F2 to rename.', mistake: 'Overwriting an existing destination file without warning.' },
  { name: 'rm', shell: 'Bash', desc: 'Delete files (and folders with -r). No Recycle Bin.', syntax: 'rm [-r] path…', win: 'Shift+Delete — permanent, not the Recycle Bin.', mistake: 'Using -r on the wrong path. Double-check before pressing Enter.' },
  { name: 'Get-ChildItem', shell: 'PowerShell', desc: 'List items; aliases ls, dir, gci. Returns objects, not text.', syntax: 'Get-ChildItem [-Path] path', win: 'Viewing a folder in File Explorer.', mistake: 'Treating output as text — it is a list of objects you can filter.' },
  { name: 'New-Item', shell: 'PowerShell', desc: 'Create files or folders.', syntax: 'New-Item -ItemType File|Directory -Name name [-Path path]', win: 'Right-click → New.', mistake: 'Forgetting -ItemType Directory when you wanted a folder.' },
  { name: 'Set-Location', shell: 'PowerShell', desc: 'Change directory; aliases cd, sl.', syntax: 'Set-Location path', win: 'Opening a folder.', mistake: 'Paths with spaces need quotes.' },
  { name: 'Remove-Item', shell: 'PowerShell', desc: 'Delete items; aliases rm, del, ri.', syntax: 'Remove-Item path [-Recurse]', win: 'Shift+Delete.', mistake: 'Omitting -Recurse on a non-empty folder.' },
  { name: 'dir', shell: 'CMD', desc: 'List a directory.', syntax: 'dir [path]', win: 'Viewing a folder in File Explorer.', mistake: 'In PowerShell dir is an alias for Get-ChildItem, not the CMD program.' },
  { name: 'md', shell: 'CMD', desc: 'Make a directory (alias of mkdir).', syntax: 'md path', win: 'New → Folder.', mistake: 'It also creates missing parent folders.' },
  { name: 'type', shell: 'CMD', desc: 'Display a text file.', syntax: 'type file', win: 'Opening in Notepad.', mistake: 'Using it on binary files prints garbage.' },
  { name: 'rd', shell: 'CMD', desc: 'Remove a directory.', syntax: 'rd [/s] path', win: 'Deleting a folder.', mistake: 'Fails on non-empty folders unless /s is given.' },
  { name: 'copy', shell: 'CMD', desc: 'Copy files.', syntax: 'copy source dest', win: 'Ctrl+C / Ctrl+V.', mistake: 'Does not copy folders (use xcopy/robocopy — not simulated here).' }];
