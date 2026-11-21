# terminally.

A calm desktop app for learning Bash, PowerShell and CMD. **Everything is simulated**: commands run against an in-memory virtual filesystem and never execute on your computer or touch your real files.

## What works (verified by automated tests unless noted)
- Three separate shell simulators (`src/shells.ts`) over one virtual filesystem (`src/machine.ts`).
- Interactive file explorer (`src/Explorer.tsx`): open folders, back/forward/up, address bar, breadcrumbs, new folder/file, rename, delete, copy/cut/paste, drag-and-drop move, context menu, text editor, properties. *UI behavior is verified by type-check and build only, not by automated UI tests.*
- Every click is translated into a shell-specific command (`src/translate.ts`), run once through the same engine as the terminal, and shown with an explanation and the other shells' equivalents. Round-trip tests cover names with spaces, quotes and special characters.
- Six themes, settings, progress, bookmarks; SQLite storage in the desktop app (localStorage in a plain browser). A failed save shows a visible warning instead of failing silently.
- 5 lessons in 3 modules (fundamentals, file management, shell differences). Multi-step lessons keep one machine across steps and are validated against filesystem state; every lesson is replayed in Bash, PowerShell and CMD by the test suite.
- 8 practice challenges (Easy/Medium/Hard) that check outcomes, not command strings, so any valid approach passes.
- Playground: save/resume a session locally, export/import sessions as JSON. Settings: export/import a progress backup. Imports are untrusted and strictly validated (names, depth, size, types, prototype-pollution keys) — see `src/session.ts`, `src/backup.ts`.

## Supported commands
Bash: `pwd cd ls mkdir touch cat rm cp mv echo clear`, redirection `>` `>>`.
PowerShell: `Get-Location Set-Location Get-ChildItem New-Item Get-Content Remove-Item Copy-Item Move-Item Rename-Item Write-Output` and common aliases.
CMD: `cd dir mkdir/md type del rmdir/rd copy move ren echo cls`.
**Not supported** (refused with a message, never faked): pipes, `&&`/`;`, wildcards, variables, `find`/`grep`/`findstr`, permissions, xcopy/robocopy.

## Known limitations
- Names typed in the terminal are not validated against Windows naming rules (the GUI does validate).
- Module 4 (searching, pipes, environment variables, permissions) is not built because the simulator does not support those features. Resizable panels and the command library's cross-shell/category views are not built. Lesson step checks run after each command, so if a step's goal is already satisfied when you reach it, run any command to continue.
- Import/export uses a paste/copy text box (no file dialog) to avoid extra native permissions.
- The Tauri/Rust shell and installer have not been compiled or launched by the author.

## Development
```
npm ci
npm test          # vitest
npx tsc --noEmit
npm run build     # frontend
npm run tauri dev # needs Rust + WebView2
```

## Windows installer
Push to GitHub; the **Build Windows installer** workflow runs tests and `tauri build --bundles nsis`, then uploads the `.exe` as an artifact. The installer is unsigned, so SmartScreen will warn ("More info" → "Run anyway").
