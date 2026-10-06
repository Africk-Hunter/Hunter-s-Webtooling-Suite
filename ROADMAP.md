# Roadmap

## Done
- [x] Core overlay, tool registry, RPC, shadow-DOM UI
- [x] Resize tool (write-back to CSS)
- [x] Inspect tool

## Next (priority order)
1. [ ] Browser-test existing tools end to end; fix issues (manual pass pending)
2. [x] Change log + undo (record every write-back as a diff; foundation for all write tools)
3. [x] Spacing editor (margin/padding handles)
4. [x] Color / theme token editor (edit `--color-*` variables)
5. [x] Typography tool (phase 1) and Content tool
6. [x] Responsive preview + `@media`-aware write-back
7. [x] Better selectors (specificity-aware, disambiguate shared classes)

## Text follow-ups
- [ ] Font family picker that also writes the Google Fonts `<link>` in `index.html` (needs `ctx.write` to allow files outside `src/`)
- [ ] Edit `--font-*` / size tokens site-wide, fluid `clamp()` helper for sizes
- [ ] Typographic scale preview across headings
- [ ] Rich text (bold/links) in Content; text with entities or template literals
- [ ] Per-breakpoint typography (`@media`)

## Later

- [ ] Developer console: collapsible panel that can be docked to any of the four viewport edges
- Layout tweaks (flex/grid/gap, drag-reorder)
- Component source jump (open `.tsx` in VS Code)
- A11y / contrast checker
- Alignment guides and spacing ruler
- Image swap + size warnings
- SEO / meta panel
- Snapshot before/after compare
- Wire into more templates; extract webtool as a standalone package

Spacing editor: drag margin and padding handles like browser devtools, then write them back to CSS.
Typography: change font size, weight and line height on the selected element, with a heading-scale preview.
Color and theme tokens: click a color to edit the --color-* variable behind it, so one edit updates the whole site.
Responsive preview: switch viewport widths and edit a rule inside a specific @media breakpoint, so you can fix mobile without leaving the page.
Inline text edit: edit copy on the page and write it back to the JSX or site.ts config. It needs source mapping, which is harder than the CSS tools.
Layout tweaks: toggle flex/grid, gap and alignment from a small control, and drag to reorder siblings.
Component source jump: click an element and open its .tsx file at the right line in VS Code.
Accessibility and contrast checker: flag low contrast, missing alt text, heading-order problems and tiny tap targets live.
Alignment guides and a spacing ruler: measure the distance between two elements and snap to a grid.
Image swap and optimization: replace an <img> by dropping a file in, and warn about oversized images.
SEO and meta panel: edit title, description and Open Graph tags per page, and write them to Seo.tsx or config.
Change log with undo: record every write-back as a diff, so you can undo any change or copy the whole session as a summary.
Snapshot compare: save a screenshot before and after a change, and view them side by side or as an overlay.
Developer console: show useful development output in a collapsible panel that can be dragged between the top, right, bottom, and left edges.

## Templates
- [x] professional-site-template
- [x] webtool-playground (component and responsive testing site)
- [ ] More templates (portfolio, landing page, store)
