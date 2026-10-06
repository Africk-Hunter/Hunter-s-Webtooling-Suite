# webtool

Dev-only Vite plugin that injects a modular overlay into your site. Toggle with **Alt+W**.
Use the toolbar’s ↔/↕ button to switch between horizontal and vertical layouts; responsive preview automatically docks the tools vertically on the left.

## Built-in tools
| Tool | Hotkey | What it does |
|---|---|---|
| Resize | Alt+R | Drag handles / type values; **Apply** writes width/height into the matching CSS rule |
| Inspect | Alt+I | Computed size, spacing, font; shows which CSS lines mention the selector |
| Spacing | Alt+S | Edit margin/padding, flex/grid display, alignment, gaps, grid columns, and item order; drag spacing controls to adjust pixel values |
| Colors | Alt+K | Preview and apply changes to `--color-*` variables defined in `:root` |
| Responsive | Alt+V | Preview the real page at mobile, tablet, or desktop widths; docks tools down the left and writes into the matching `@media` range |
| Typography | Alt+T | Live-edit type styles, edit site-wide font/size tokens, generate fluid `clamp()` size tokens, preview a heading scale, and load/apply Google Fonts; supports breakpoint-specific writes |
| Content | Alt+C | Edit plain text and inline bold/italic/underline/links; maps JSX entities and statically evaluable template literals back to `.ts`/`.tsx` source |
| History | Alt+H | Every source write webtool made, with diffs and per-change undo and redo; copy a session summary |
| DevConsole | Alt+D | Capture console output, runtime errors, and unhandled promise rejections; filter, clear, collapse, or dock to any edge |

The toolbar’s **↔ / ↕** button switches between horizontal and vertical layouts. Responsive preview automatically docks the toolbar on the left.

## Writing a tool

```
tools/mytool/
  client.js   // browser side (required)
  server.js   // node side (optional)
```
Register in `tools/index.js` (or pass `webtool({ tools: [...] })`):
```js
{ id: 'mytool', client: path.join(here, 'mytool', 'client.js'), server }
```

### client.js
```js
export default {
  id: 'mytool', name: 'My Tool', hotkey: 'm',   // Alt+M
  activate(api) {},                             // tool switched on
  deactivate() {},                              // switched off — clean up boxes/listeners
  onSelect(el, api) {},                         // user clicked an element
}
```
`api`: `selected`, `select(el)`, `selectorFor(el)`, `rpc(method, payload)`, `deactivate()`, `panel.set(html|Node)` / `panel.clear()`, `box({outline, fill})` → `{follow(el), refresh(), hide(), destroy(), el}`, `preview` (`set(el, prop, value)`, `decls(el)`, `reset(el?)`, `commit(el)` — staged inline edits with rollback), `toast(text)`, `on('scroll'|'resize'|'select', fn)`, `root` (shadow root).

### server.js
```js
export const server = {
  async doThing(payload, ctx) { return { ... } },   // called via api.rpc('doThing', payload)
}
```
`ctx`: `root`, `srcDir`, `css.files()`, `css.setDeclarations(selector, decls, {tool, media})`, `css.setCustomProperties(values, {tool})`, `source.files(exts)` / `source.rel` / `source.abs`, `fs.read`, `write(absFile, content, {tool, label})`, `history`. CSS writes update an exact selector at the base level or inside the exact selected media query; absent rules are created in `index.css` (or the first CSS file), and absent media blocks are created. **All source writes must go through `ctx.write`** (directly or via `css.*`) so they are recorded in `.webtool/history/` and undoable. Undo refuses if the file changed since the edit. Return `{ file }` from a handler that writes; the client then emits the `write` event. Add new shared helpers in `src/server-context.js`.
`ctx.project.abs(rel)` resolves a path inside the project root for intentional non-`src/` edits such as Google Fonts links in `index.html`; use `ctx.write` for the write so History can undo it.

## Rules
- Never write files from the client; go through `rpc`. Validate all payloads.
- Clean up in `deactivate()`.
- Keep overlay UI inside the shadow DOM.

## Limitations
- Content edits support JSX entities, basic inline rich text, and template literals with static literal/number/boolean interpolation. Dynamic variable expressions and text split through computed components are not safely mappable.
- Typography can edit `--font-*` / size tokens under top-level `:root`; the clamp helper currently generates pixel-based fluid sizes.
- CSS edits update exact matching selectors; otherwise a new rule is added to `index.css`. Selector menus offer a unique element path alongside reusable class, parent, and tag scopes.
- Responsive preview runs the page in a same-origin iframe at the selected width. Style edits target that exact `@media` query, creating it if absent.
- Color tokens are discovered from top-level `:root` rules in source CSS and written through undoable history.

## Developing webtool itself
Edits to `src/client/core.js` and any tool's `client.js` reload the page automatically. Edits to server code (`src/index.js`, `src/server-context.js`, any `server.js`) need a dev server restart.

Run server-context regression tests with `npm test` from `devtool/`. The `Site Templates/webtool-playground` template is the manual browser-testing sandbox; end-to-end browser verification is still pending.

`selectorCandidates(el)` returns unique-element, currently matching CSS rules (ordered by estimated specificity), reusable class/parent scopes, and a tag scope. `responsive.setViewport(width, media)` accepts viewport widths from 240–1920px and an optional media-query condition; `responsive.media` is passed to style writes so they target that breakpoint.
