# Handoff: Change log + undo (webtool)

Status: **IMPLEMENTED and browser-verified (2026-10-05).** Kept for design rationale; see code in `devtool/src/server-context.js` and `devtool/tools/history/`.

## Goal
Every source write made by a webtool tool is recorded, reviewable as a diff, and individually undoable. Today `ctx.css.setDeclarations()` overwrites files with no record of the previous contents.

## Current state (verified by browser test, 2026-10-05)
- Resize Apply works end to end: `resize/client.js` -> `api.rpc('apply')` -> `resize/server.js` -> `ctx.css.setDeclarations()` in `devtool/src/server-context.js`, which edits via postcss and calls `fs.writeFileSync`.
- That `fs.writeFileSync` (two call sites: patch existing rule, append new rule) is the only place source is written. It is the single choke point to hook.
- Server handlers receive `(payload, ctx)`; `ctx` is built once in `createServerContext(root)` and shared.
- Core (`src/client/core.js`) gives tools an `api` with `rpc`, `panel`, `box`, `toast`, `on`. Toolbar is built from the tools list.
- Tests so far were manual (Playwright + Edge against `npm run dev` of `Site Templates/professional-site-template`). There is no automated test suite.

## Design
1. **Write wrapper in `ctx`**: add `ctx.fs.write(file, newContent, meta)` (or `ctx.history.record`) in `server-context.js`. Before writing, read old content; write; append an entry. Route both `writeFileSync` calls in `css.setDeclarations` through it. Future write tools must use it too (document in `devtool/README.md` and `CLAUDE.md`).
2. **Storage**: `<project root>/.webtool/history/`. One JSON entry per change: `{ id, ts, tool, label, file (relative to srcDir), before, after }`. Store full before/after file text (files are small; avoids patch-apply failures). Add `.webtool/` to the template's `.gitignore` and the root one. Keep in-memory index plus on-disk files so history survives dev server restarts. Cap at e.g. 200 entries.
3. **Meta from tools**: `setDeclarations` gets an optional `meta = { tool, label }` so entries read like "resize .hero: height 386px". Resize's server handler should pass it.
4. **Server API**: new built-in tool `history` with handlers `list()`, `diff({id})`, `undo({id})`, `summary()`. Because it is a normal tool, it needs no plugin changes beyond registering in `tools/index.js`.
5. **Undo safety**: undo restores `before` only if the file's current content equals the entry's `after` (the user hasn't edited since). Otherwise return a conflict error and show it in the UI; do not overwrite. Undoing an older entry while newer ones exist on the same file will conflict by this rule; acceptable for v1 (undo newest first), mention it in the UI message.
6. **Client**: `tools/history/client.js`, hotkey `h`. Panel lists entries newest first (time, tool, label, file), expandable unified diff (generate server-side, small line diff; no new dependency required, or use the `diff` package), Undo button per entry, "Copy session summary" button (markdown list of changes via `navigator.clipboard`).
7. **Live refresh**: other tools should trigger a history refresh after Apply. Simplest: core emits a `'write'` event; add it to the documented `api.on` events and emit it from `api.rpc` success when the result carries `{ file }`, or have the history tool poll `list` on activate/panel focus. Prefer the event.

## Gotchas
- Vite HMR fires on each write; undo writes will also HMR. That's desired.
- Write via temp-file-then-rename is not needed; keep `writeFileSync`.
- Inputs from the client are untrusted: `id` must be validated against known entries; never accept a file path from the client for undo.
- Windows paths: existing code uses `path.relative`, which returns backslashes (`pages\pages.css`). Normalize to forward slashes in stored entries.
- Client modules are served raw through Vite virtual modules: no imports other than the `api`, plain browser JS.
- Keep core generic; history logic belongs in `tools/history` plus the `ctx` helper, not in `core.js` beyond the optional `'write'` event.

## Files to touch
- `devtool/src/server-context.js` (write wrapper, history store)
- `devtool/tools/resize/server.js` (pass meta)
- `devtool/tools/history/{client.js,server.js}` (new)
- `devtool/tools/index.js` (register)
- `devtool/src/client/core.js` (optional `'write'` event)
- `.gitignore` (root) and template `.gitignore` (`.webtool/`)
- `devtool/README.md`, `CLAUDE.md`, `ROADMAP.md` (docs, tick the item)

## Done when
- Applying a resize creates a history entry; it appears in the History tool with a correct diff.
- Undo restores the exact previous file contents and the page updates via HMR.
- Undo after a manual edit of the same file reports a conflict and changes nothing.
- History persists across a dev server restart.
- Verified in the browser with the Playwright + Edge approach used before (script was scratch-only; re-create it). Remember to back up or revert test edits to template CSS, since the template is not under version control separately.

## Open questions for Hunter
- Cap size/retention (default 200 entries)?
- Should undo-by-id for non-newest entries attempt a 3-way merge later, or stay strict?
