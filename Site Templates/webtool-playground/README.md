# Webtool Playground

A responsive sample site built to try the webtool against repeated components, nested selectors, typography, spacing, CSS color tokens, and mobile layouts.

```sh
npm install
npm run dev
```

`npm run build` typechecks and builds for production. Toggle webtool with **Alt+W**. The playground has no production dependency on webtool; the Vite plugin runs only during development.

## Useful areas to experiment with

- Repeated feature cards and pricing cards for selector scope and specificity.
- Theme colors in `src/playground.css` under `:root` (`--color-*` tokens).
- Type tokens can be added under `:root` (`--font-*`, `--size-*`) or generated with the Typography clamp helper.
- Responsive navigation, grids, poster artwork, and form layout.
- Text in `src/App.tsx` for the Content tool.

Available tools: Resize (Alt+R), Inspect (Alt+I), History (Alt+H), Typography (Alt+T), Spacing (Alt+S), Colors (Alt+K), Responsive (Alt+V), and Content (Alt+C). End-to-end browser verification is a manual step.
