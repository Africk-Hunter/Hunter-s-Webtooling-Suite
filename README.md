# Hunter's Webtooling Suite

Tools for building websites faster.

| Folder | What |
|---|---|
| [devtool/](devtool/) | **webtool** — modular in-browser dev overlay (Vite plugin) |
| [Site Templates/](Site%20Templates/) | Starter sites and the [webtool playground](Site%20Templates/webtool-playground/) |

## Quick start
```bash
cd "Site Templates/webtool-playground"
npm install
npm run dev
```
The playground has repeated components, responsive layouts, and color tokens for experimenting with webtool. Press **Alt+W** to open the tools; click a page element to inspect or edit it.

To start the more complete business-site template instead:
```bash
cd "Site Templates/professional-site-template"
npm install
npm run dev
```

## Tools

| Tool | Shortcut | Purpose |
|---|---|---|
| Resize | Alt+R | Preview and write element width/height to CSS |
| Inspect | Alt+I | View computed styles and CSS locations |
| History | Alt+H | Review, diff, undo, and redo webtool source writes |
| Typography | Alt+T | Preview and apply typography settings |
| Spacing | Alt+S | Edit spacing and flex/grid layout properties |
| Colors | Alt+K | Preview and write `--color-*` theme tokens |
| Responsive | Alt+V | Preview mobile, tablet, and desktop widths |
| Content | Alt+C | Write rendered text changes back to TSX source |
| DevConsole | Alt+D | View console output and runtime errors in a filterable, collapsible panel dockable to any viewport edge |

Use the toolbar’s **↔ / ↕** control to switch between horizontal and vertical layouts. Responsive preview docks the tools vertically on the left.

## Using webtool in another Vite project
```bash
npm install --save-dev /path/to/Hunter's\ Webtooling\ Suite/devtool
```
```ts
// vite.config.ts
import webtool from 'webtool-devtool'
export default defineConfig({ plugins: [webtool()] })
```
Expects CSS files under `src/` for CSS write-back and TS/TSX files under `src/` for Content edits.

See [devtool/README.md](devtool/README.md) for tool details and the tool API, [CLAUDE.md](CLAUDE.md) for repository architecture and development conventions, and [ROADMAP.md](ROADMAP.md) for planned work. End-to-end browser testing remains a manual pass.
