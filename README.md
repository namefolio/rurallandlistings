# TattooStudioGuide.com

A static directory of US tattoo shops. Astro (static output, zero client JS) served by Cloudflare Workers static assets; one tiny Worker handles the "Add your business" form. Listings are JSON files, so an AI agent can maintain them: see [UPDATING.md](UPDATING.md). Research and design decisions: [docs/BRIEF.md](docs/BRIEF.md).

## Develop

```sh
npm install
npm run dev            # includes demo listings
npm run check          # types + content schema (warns while PLACEHOLDER values remain)
npm test               # form handler + Verified expiry tests
npm run build          # production build (demo listings excluded)
npm run build:demo     # build with demo listings
npm run check:wording  # after a build: no "verified" wording outside the Verified tier copy
npm run lighthouse     # after build:demo: mobile Lighthouse on home, a city and a listing; fails below 100
npm run preview        # build:demo + wrangler dev (form works locally with .dev.vars test keys)
```

For the form locally, copy `.dev.vars.example` to `.dev.vars` (Turnstile test keys).

## Deploy

Pushing to `main` deploys through Cloudflare **Workers Builds** (Worker `tattoostudioguide` > Settings > Builds, connected to this repo). Build command: `npm run build:demo` while only demo listings exist, then `npm run build`. Deploy command: `npx wrangler deploy`. No Cloudflare secrets are needed in GitHub. Manual: `npm run deploy` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set.

`.github/workflows/daily-rebuild.yml` calls a Workers Builds deploy hook once a day, so an expired `verifiedUntil` drops to Basic without a push. Create the hook (Worker > Settings > Builds > Deploy Hooks) and save its URL as the repo secret `DEPLOY_HOOK_URL`; until then the workflow skips.

One-time dashboard steps:
1. **Custom domain:** Worker > Settings > Domains & Routes > add the apex and `www`.
2. **Email Routing:** enable it on the zone and verify `hello@namefolio.co` as a destination. The `send_email` binding only delivers to verified addresses; the sender `submissions@tattoostudioguide.com` must be on the zone.
3. **Turnstile:** create a widget for the domain; put the site key in `wrangler.jsonc` (`TURNSTILE_SITE_KEY`) and run `npx wrangler secret put TURNSTILE_SECRET`. Without the secret the form fails closed.
4. **Payment:** Verified is invoiced by email (`mailto:hello@namefolio.co`); if you switch to a Stripe Payment Link, set its success URL to `/listing-plans/`.
5. **AI Crawl Control:** make sure AI crawlers are allowed; optionally enable Markdown for Agents.

## Start the next domain from this repo

The engine (`src/lib`, `src/pages`, `src/components`, `src/styles`, `src/worker.ts`, `src/form.ts`) holds no niche words. For a new site change only:

- `site.config.ts`: name, domain, placeholders, entity nouns, URL hub, schema.org type, credential check, regions, attributes, taxonomies, card facts, FAQs and title templates.
- `src/theme.css`: palette, font and feel (and swap `public/fonts/`, `public/favicon.svg`).
- `docs/BRIEF.md`: the new keyword research and design direction.
- `src/content/listings/**`: the listing files (`npm run remove-demo`, then `npm run import-csv`).
- `wrangler.jsonc` and `astro.config.mjs`: the Worker name and site URL.
