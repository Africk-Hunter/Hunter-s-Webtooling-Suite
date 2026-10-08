# Store Template

A small storefront with a product grid and cart summary. Built with Vite, React 18 and TypeScript, with webtool wired in for development.

```sh
npm install
npm run dev
```

`npm run build` typechecks and builds for production. Toggle webtool with **Alt+W**; the plugin runs only in the dev server.

- Colors and fonts are tokens at the top of `src/styles.css` (`--color-*`, `--font-*`), so the Colors and Typography tools edit them site-wide.
- Copy lives in `src/App.tsx`, so the Content tool can write text edits back.
- Replace placeholder imagery by dropping a file onto an image with the Images tool (Alt+G).
