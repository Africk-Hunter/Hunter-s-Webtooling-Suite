# Hunter's Webtooling Suite

Tools that help Hunter build websites faster. Two parts:

- `devtool/` — **webtool**, a dev-only Vite plugin that overlays modular tools on a site being developed (resize, inspect, …) and can write changes back to source files. This is the main project.
- `Site Templates/` — starter sites and test targets. `professional-site-template` is the full Vite + React 18 + TypeScript site; `webtool-playground` is a smaller responsive React + TypeScript sandbox with repeated components and theme tokens. `portfolio-template`, `landing-page-template` and `store-template` are lean starters with `--color-*`/`--font-*` tokens.

## Commands
- Template dev server: `cd "Site Templates/professional-site-template" && npm run dev`
- Playground dev server: `cd "Site Templates/webtool-playground" && npm run dev`
- Template typecheck/build: `npm run typecheck` / `npm run build`
- Playground build: `npm run build` (also typechecks)
- webtool regression tests: `cd devtool && npm test`
- After changing `devtool/package.json` deps: `npm install` in `devtool/`, then reinstall in any template using the local package.
- In the page: **Alt+W** toggles webtool; tool hotkeys are Alt+<key>: Resize=R, Inspect=I, History=H, Typography=T, Spacing=S, Colors=K, Responsive=V, Content=C, A11y=A, Source=O, Layout=L, Measure=M, Images=G, SEO=E, Snapshots=P, DevConsole=D. Use the toolbar's ↔/↕ button to switch the default left sidebar to a horizontal bar.

## Architecture (devtool)
- `src/index.js` — Vite plugin (`apply: 'serve'` only). Serves virtual modules (`virtual:webtool/entry|core|tool/<id>`), injects the entry script, and routes `POST /__webtool/rpc/<tool>/<method>` to the tool's server handler after `src/rpc-guard.js` checks Host, Origin, JSON content type and the per-run token (the endpoint writes source files, so other sites must not reach it).
- `src/client/core.js` — overlay shell in a shadow DOM: toolbar, shared element picking/hover, panel, highlight boxes, responsive iframe preview, selector candidates, toasts, RPC. Tools get an `api` object from it.
- `src/server-context.js` — `ctx` passed to server handlers (`root`, `srcDir`, project-root and source helpers, CSS discovery/writes, token writes, and undoable history). CSS writes use PostCSS, find rules inside `@layer`/`@supports`, can target an exact `@media` query, refuse any output that doesn't parse, and return `warning` when a class isn't in any stylesheet (CSS modules/Tailwind); project-root writes support undoable `index.html` font links.
- `src/source-text.js` � finds/replaces an exact rendered string inside TS/TSX source (used by Content).
- `tools/<id>/client.js` (default export tool object) + optional `server.js` (`export const server = { method(payload, ctx) }`), registered in `tools/index.js`. Built-ins: Resize, Inspect, History, Typography, Spacing, Colors, Responsive, Content, Source, Layout, Measure, Images, SEO, Snapshots, A11y, and DevConsole.
- Full tool contract is documented at the top of `core.js` and in `devtool/README.md`.

## Conventions
- Core stays generic; features belong in tools. A tool must not reach into another tool's internals.
- Client code is plain browser JS (no build step, no imports except from the core api). It is served as-is through Vite virtual modules.
- All source writes go through server handlers and `ctx.write` (history + undo depend on it); never write files from the client. Validate payloads server-side before writing; `SAFE_PROP` and `isSafeValue` in `src/server-context.js` constrain CSS declarations (no comments, unbalanced quotes/parens, or `;{}`).
- Selector pickers offer a unique element path, matching existing selectors (ranked by specificity), parent/class scopes, and the tag scope. Responsive edits carry the selected media query through to the server.
- Dev-only: nothing from webtool may end up in production builds.
- Overlay UI lives in the shadow DOM so it never inherits or leaks site styles.
- Match existing style: ES modules, no semicolons, single quotes, 2-space indent.

## Status / roadmap
See `ROADMAP.md`. Built tools include core, Resize, Inspect, History (change log + undo), Typography (Google Fonts, size/font tokens, fluid `clamp()` helper, heading scale, breakpoints), Content (safe inline rich text/source mapping), Spacing, Colors, Responsive, A11y (contrast, alt text, heading order, tap targets, names, labels), and DevConsole (captured runtime output with edge docking). The `webtool-playground` template is available for manual testing; the end-to-end browser pass is still pending.
