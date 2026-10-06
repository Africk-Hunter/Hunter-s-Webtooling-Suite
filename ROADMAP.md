# Roadmap

## Done
- [x] Core overlay, tool registry, RPC, and shadow-DOM UI
- [x] Resize tool (write-back to CSS)
- [x] Inspect tool
- [x] History + change log + undo/redo
- [x] Typography tool
- [x] Content tool
- [x] Spacing tool (margin/padding, flex/grid controls)
- [x] Colors tool (`--color-*` token edits)
- [x] Responsive preview + `@media`-aware writes
- [x] Better selector matching and specificity-aware disambiguation
- [x] `professional-site-template`
- [x] `webtool-playground`

## Now / before launch
- [ ] End-to-end browser pass for the existing tools; fix issues found during manual validation
- [ ] Regression checks for server-side write safety and selector resolution
- [ ] Tighten the project API so it is easier to adopt in additional templates

## Near-term
- [x] Font family picker that writes Google Fonts `<link>` tags into `index.html` through undoable project-root writes
- [x] Site-wide `--font-*` and size-token editor with fluid `clamp()` helpers
- [x] Typographic scale preview across heading styles
- [x] Richer text editing in Content for bold/links, JSX entities, and statically evaluable template literals
- [x] Per-breakpoint typography controls (`@media`)
- [x] Developer console panel with collapsible, dockable layout

## Later
- [ ] Layout tweaks (flex/grid/gap/alignment, drag-reorder)
- [ ] Component source jump (open `.tsx`/`.jsx` at the right line in VS Code)
- [ ] A11y / contrast checker
- [ ] Alignment guides and spacing ruler
- [ ] Image swap + size warnings
- [ ] SEO / meta panel
- [ ] Snapshot before/after compare
- [ ] More templates (portfolio, landing page, store)
- [ ] Extract webtool into a standalone package for reuse across Vite projects

## Working principles
- Spacing editor: drag margin and padding handles like browser devtools, then write them back to CSS.
- Typography: change font size, weight, and line height on the selected element, with a heading-scale preview.
- Color and theme tokens: click a color to edit the underlying `--color-*` variable, so one edit propagates across the site.
- Responsive preview: switch viewport widths and edit a rule inside a specific `@media` breakpoint, so you can fix mobile without leaving the page.
- Inline text edit: edit copy on the page and write it back to the source file that rendered it.
- Layout tweaks: toggle flex/grid, gap, and alignment options from a compact control surface.
- Component source jump: open a component or page file at the referenced element position in VS Code.
- Accessibility and contrast checker: flag low contrast, missing alt text, heading-order issues, and tiny tap targets live.
- Alignment guides and spacing ruler: measure the distance between elements and snap to a grid.
- Image swap and optimization: replace an `<img>` by dropping a file in and warn about oversized assets.
- SEO and meta panel: edit title, description, and Open Graph tags per page.
- Change log with undo: record every write-back as a diff so you can undo any step or summarize the session.
- Snapshot compare: save screenshots before and after a change, then compare them side by side or as an overlay.
- Developer console: show useful development output in a collapsible panel that can be docked to any edge of the viewport.
