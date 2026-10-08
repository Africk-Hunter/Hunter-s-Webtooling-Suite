# Professional Site Template

A generic starting point for small-business marketing sites: Vite + React + TypeScript + React Router, plain CSS with design tokens, EmailJS contact form, Netlify-ready.

Distilled from the Biggest Little Media and Luna Lash & Beauty Co. sites, with all client-specific content, the Firebase/Cloudinary admin panel and the Gatsby/Netlify CMS setup removed.

## Pages

Home, About, Services (with pricing cards), Gallery, FAQ (accordion), Contact (form), 404.

## Run it

```sh
npm install
npm run dev        # dev server with the webtool overlay
npm run typecheck  # TypeScript check only
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

In dev, press **Alt+W** to toggle webtool (Resize Alt+R, Inspect Alt+I, History Alt+H, Typography Alt+T, Spacing Alt+S, Colors Alt+K, Responsive Alt+V, Content Alt+C). It is dev-only and never included in production builds. `webtool-devtool` is installed from `../../devtool`, so run `npm install` in `devtool/` first if that folder's dependencies are missing.

## Start a new site

1. Copy this folder, then `npm install` and `npm run dev`.
2. Edit **`src/config/site.ts`**: business name, contact details, nav, per-page SEO, and all page copy (hero, features, services, about, gallery, FAQ, CTA).
3. Retheme in **`src/index.css`**: colors, fonts and radius are CSS variables at the top. Update the Google Fonts link in `index.html` to match.
4. Replace `public/favicon.svg` and add `public/og-image.png` (1200x630). Put gallery/about images in `public/` and reference them from `site.ts`.
5. Update the placeholder domain in `index.html` (meta tags and JSON-LD), `public/robots.txt` and `public/sitemap.xml`.
6. Copy `.env.example` to `.env` and fill in the EmailJS keys. The EmailJS template should use the variables `name`, `email`, `phone`, `message`.
7. Deploy to Netlify (`netlify.toml` includes the SPA redirect).

For the full pre-launch checklist (SEO, OG image, EmailJS env vars, deployment, accessibility, handoff), see **[LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)**.

## Adding a page

1. Create `src/pages/MyPage.tsx`.
2. Add a `<Route>` in `src/App.tsx`.
3. Add an entry to `pages` (SEO) and `nav` in `src/config/site.ts`, and a `<url>` in `public/sitemap.xml`.

## Structure

```
src/
  config/site.ts      all client-specific content
  components/         Layout, Nav, Footer, Seo, CallToAction, Accordion (+ components.css)
  pages/              one file per route (+ pages.css)
  utils/phone.ts      phone input formatter
  index.css           tokens, reset, buttons, cards, layout helpers
```

## Not included (add per project when needed)

Admin panel / auth / database (Firebase), media hosting (Cloudinary), a CMS, page transitions.
