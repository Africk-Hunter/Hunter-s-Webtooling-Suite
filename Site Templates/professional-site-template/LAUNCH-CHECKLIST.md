# Launch Checklist: Turning the Template Into a Real Site

The README covers the quick start. This document covers what actually matters, and what silently breaks, when this template becomes a client's live site. Work through it top to bottom.

Every value below that still reads `example.com`, `Your Business Name`, `555`, or `Lorem`-style filler is a placeholder. Search for these before launch (see [Final sweep](#final-sweep)).

---

## 1. Where things live (and the duplication trap)

Client content is centralized in `src/config/site.ts`, but **some values are duplicated outside it** because crawlers that skip JavaScript only see `index.html` and `public/`. When you change one of these, change all copies:

| Value | `site.ts` | Also update |
| --- | --- | --- |
| Business name / tagline | `site.name`, `site.tagline`, `pages['/']` | `index.html`: `<title>`, `description`, `og:title`, `og:description`, JSON-LD `name` |
| Domain | `site.url` | `index.html`: `og:image`, JSON-LD `url`; `public/robots.txt` (Sitemap line); `public/sitemap.xml` (every `<loc>`) |
| Email / phone / address | `site.contact` | `index.html`: JSON-LD `email`, `telephone`, `address` |
| OG image | `site.ogImage`, per-page `pages[...].image` | `index.html`: `og:image` (absolute URL); the file `public/og-image.png` (1200x630) must exist |
| Brand color | `--color-primary` in `src/index.css` | `index.html`: `<meta name="theme-color">` |
| Fonts | `--font-heading`, `--font-body` in `src/index.css` | `index.html`: Google Fonts `<link>` |

`Seo.tsx` rewrites title, description, canonical, Open Graph and Twitter tags at runtime, so browsers and Google (which runs JS) see the right per-page values. Facebook, LinkedIn, Slack, iMessage and most other link-preview scrapers **do not run JS**, so they only see the static tags in `index.html`. Keep those accurate.

---

## 2. Identity and content

- [ ] `site.ts`: `name`, `tagline`, `url`, `contact`, `social`, `credit`. Remove or replace the `credit` line if it is not yours.
- [ ] `social`: replace the generic `instagram.com` / `facebook.com` links with the client's profiles, or delete entries they don't have. A link to a platform's home page looks unfinished.
- [ ] Page copy: `hero`, `features`, `services`, `about`, `faqs`, `cta`. Prices are free-form strings; use `'Contact for pricing'` if there is none.
- [ ] Add or remove items freely: `features`, `services`, `faqs` and `gallery` are plain arrays, and the pages render whatever is there.
- [ ] Remove pages the client doesn't need (see [Adding or removing pages](#7-adding-or-removing-pages)).

---

## 3. Images and assets

- [ ] **Favicon**: replace `public/favicon.svg`. It is also used as the nav logo (`site.logo`), so either keep it logo-shaped or point `site.logo` at a separate file.
- [ ] **OG image**: required, and not included in the template. See the [OG image](#og-image-social-share-preview) subsection below.
- [ ] **Gallery / About images**: put files in `public/` (e.g. `public/gallery/`) and set `src` in `site.ts` using paths like `/gallery/01.jpg`. An empty `src` renders a placeholder tile, which must not ship.
- [ ] Compress and size images before adding them (target under 200 KB each, around 1600px wide max). Always write real `alt` text; it is used for accessibility and SEO.

---

### OG image (social share preview)

The image shown when the site is shared on Facebook, LinkedIn, Slack, iMessage, X, etc. It is the most commonly forgotten launch item, because the template wires it up but ships **no file**.

How it is wired:

- `site.ogImage` in `src/config/site.ts` (default `/og-image.png`) is the site-wide image. A page can override it with `image` in its `pages` entry.
- `Seo.tsx` sets `og:image` and `twitter:image` at runtime as `site.url + image` (so `site.url` must be the real domain).
- `index.html` has a static `og:image` fallback for scrapers that skip JS. It is hard-coded to `https://www.example.com/og-image.png`. **Update it by hand.**

Launch steps:

- [ ] Create `public/og-image.png`: **1200x630 px** (1.91:1), PNG or JPG, under about 300 KB (hard limits: 8 MB on Facebook, 5 MB on X). Use the logo/brand plus the business name; keep text and key content inside the central ~1000x500 area since platforms crop differently.
- [ ] If you use a different filename or format (e.g. `og-image.jpg`), update `site.ogImage` **and** the `index.html` `og:image` URL.
- [ ] Set `index.html` `og:image` to the absolute production URL (`https://clientdomain.com/og-image.png`).
- [ ] Optionally add `<meta property="og:image:width" content="1200" />`, `og:image:height` `630`, and `og:image:alt` to `index.html` for faster, more accessible previews.
- [ ] Deploy, then verify the image URL loads directly in a browser (not a 404 or the SPA's HTML page, which is what the Netlify redirect returns for missing files).
- [ ] Test the live URL in the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) and X/Slack. Scrapers cache previews, so use these tools to force a re-scrape after any change.

---

## 4. Theme

Edit the CSS variables at the top of `src/index.css`: colors, `--font-heading`, `--font-body`, `--radius`, `--shadow`, `--container`, `--nav-height`. Components read these tokens, so avoid hard-coding colors in component CSS.

- [ ] Update the Google Fonts `<link>` in `index.html` to match the chosen fonts. Load only the weights you use.
- [ ] Check text/background **contrast** (WCAG AA, 4.5:1 for body text) for `--color-primary` on `--color-on-primary`, and `--color-text-muted` on `--color-bg`. Light accent colors on white are the usual failure.
- [ ] Update `theme-color` in `index.html` to match `--color-primary`.

---

## 5. SEO

- [ ] Write a unique `title` (about 50-60 chars) and `description` (about 150-160 chars) for **each** entry in `pages`. Unlisted paths fall back to the `/` entry.
- [ ] Edit `index.html` JSON-LD: set `@type` to something more specific if one fits (e.g. `Dentist`, `HairSalon`, `LegalService`, `Photographer`), and add `openingHours`, `priceRange`, `image`, `sameAs` (social URLs) and a full street address for local businesses. Remove fields you don't have rather than leaving placeholders. Validate it at <https://validator.schema.org/>.
- [ ] `public/sitemap.xml`: update the domain, and add or remove `<url>` entries to match your real routes. Exclude the 404 page.
- [ ] `public/robots.txt`: update the `Sitemap:` line. Keep `Allow: /` for production. If you deploy a staging site, use `Disallow: /` there (or password-protect it) so it does not get indexed.
- [ ] Canonical URLs are generated from `site.url`. Decide **www vs. apex** once, use that form everywhere, and redirect the other to it in your host's domain settings. A mismatch splits SEO signals.
- [ ] After launch: add the site to Google Search Console and submit `sitemap.xml`.

**Known limitation:** this is a client-side rendered SPA. Google renders JS and handles it, but it is slower to index than static HTML, and non-JS scrapers only see the `index.html` fallbacks. For sites where search or link previews matter a lot, consider prerendering (e.g. `vite-plugin-prerender`, or a migration to Astro/Next).

---

## 6. Contact form (EmailJS)

The form in `src/pages/Contact.tsx` sends mail directly from the browser through EmailJS.

- [ ] Create an EmailJS account **under the client's email** (or one you will hand over), connect an email service, and create a template using exactly these variables: `name`, `email`, `phone`, `message`.
- [ ] `cp .env.example .env` and fill in `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY`.
- [ ] **Set the same three variables in the host's environment settings** (Netlify: Site settings > Environment variables). `.env` is not deployed. Vite inlines `VITE_*` values at **build time**, so you must **redeploy after changing them**. A missing value gives a form that appears to work but fails on submit.
- [ ] `.env` must stay out of git. Confirm it is in `.gitignore`.
- [ ] These keys end up in the public JS bundle by design (EmailJS public key model). Protect against abuse in the EmailJS dashboard: restrict allowed domains, and enable rate limits/reCAPTCHA if you see spam.
- [ ] **Test with a real submission on the deployed site**, not just locally, and confirm the email arrives and is not in spam. Check the failure path too (e.g. block the network and confirm the user sees an error).
- [ ] EmailJS free tier has a monthly send cap. If the client expects volume, upgrade, or swap to a form backend (Netlify Forms, Formspree, or a serverless function).
- [ ] If you collect personal data, link a privacy policy near the form (see Legal below).

---

## 7. Adding or removing pages

**Add**

1. Create `src/pages/MyPage.tsx`.
2. Add a `<Route>` in `src/App.tsx`.
3. Add an entry to `pages` (SEO) and, if it should appear in the header, to `nav` in `src/config/site.ts`.
4. Add a `<url>` to `public/sitemap.xml`.

**Remove**

1. Delete the route in `src/App.tsx`, and the page file.
2. Remove it from `nav`, `pages`, `sitemap.xml`, and any CTA/button that links to it (`hero.primaryCta`, `hero.secondaryCta`, `navCta`, `cta`, footer links).
3. Search the project for the old path (e.g. `/gallery`) to catch stragglers.

The 404 page catches unknown routes inside the app; the `netlify.toml` redirect makes deep links resolve to the SPA. Note it returns HTTP 200 for unknown URLs (a "soft 404"), which is acceptable for small sites.

---

## 8. Deployment

`netlify.toml` is preconfigured: build `npm run build`, publish `dist`, plus the SPA redirect.

- [ ] `npm run build` passes locally (it runs `tsc` first, so type errors fail the build). Run `npm run preview` and click through every page.
- [ ] Set the EmailJS environment variables on the host (see section 6).
- [ ] Connect the custom domain, enable HTTPS, and set the www/apex redirect.
- [ ] **Other hosts** (Vercel, Cloudflare Pages, S3, etc.) need their own equivalent of the SPA fallback rule, otherwise refreshing `/services` returns 404. `netlify.toml` is ignored elsewhere.
- [ ] Confirm webtool is not in production. It is a dev-only Vite plugin (`apply: 'serve'`) and should not appear in `dist/`. Quick check: `grep -ri webtool dist` should find nothing. It is a `devDependency` and can be removed from `vite.config.ts` and `package.json` entirely for a handed-off client repo.

---

## 9. Quality pass before launch

- [ ] **Responsive**: check at roughly 360, 768, 1024 and 1440 px widths. Use webtool's Resize/Responsive tools in dev.
- [ ] **Mobile nav** opens, closes, and navigates correctly.
- [ ] **Keyboard**: tab through every page. Focus is visible, the FAQ accordion works with Enter/Space, and the form is operable.
- [ ] **Lighthouse** (Chrome DevTools) on Home and Contact: aim for 90+ on Performance, Accessibility, Best Practices, SEO. The usual culprits are large images and unused font weights.
- [ ] **Link check**: every nav, footer, CTA and social link goes somewhere real. `mailto:` and `tel:` links use the client's real details.
- [ ] **Link preview**: paste the live URL into Slack/iMessage/LinkedIn and confirm title, description and image.
- [ ] Spelling and proofreading of all copy, including the 404 page.

---

## 10. Legal and compliance

Not provided by the template; decide per client and jurisdiction:

- Privacy policy (needed if the contact form collects personal data), and terms if relevant.
- Cookie consent banner, **only** if you add analytics or tracking. The template itself sets none. Google Fonts loaded from Google's CDN transmits visitor IPs to Google, which some EU regulators treat as a privacy issue; self-host the fonts if that matters.
- Business-specific disclosures (licensing numbers, medical/financial disclaimers).

---

## 11. Analytics (optional)

None is included. If the client wants it, prefer a privacy-friendly option (Plausible, Fathom) or GA4. Because this is an SPA, make sure page views fire on **route changes**, not just the initial load (hook into `useLocation`, as `Seo.tsx` does).

---

## 12. Handoff

- [ ] Client owns (or has admin access to) the domain registrar, hosting account, EmailJS account and analytics.
- [ ] Write down where each lives and who pays. Do not leave credentials only in your own accounts.
- [ ] Explain how to change content: edit `src/config/site.ts`, commit, and the host redeploys. If the client needs to self-edit, add a CMS (not included).
- [ ] Update this folder's `README.md` title/description and `package.json` `name` so the repo describes the client's project, not "professional-site-template".

---

## Final sweep

Search the whole project (excluding `node_modules` and `dist`) for leftovers. Each of these should return nothing:

```
example.com
Your Business Name
555
Feature one / Service one / Question one
Gallery image
Your Name
hello@example
```

Also confirm `public/og-image.png` exists and `dist/og-image.png` appears after a build.

Then build, preview, and test the live deployment once more.
