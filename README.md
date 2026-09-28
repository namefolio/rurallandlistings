# RuralLandListings.com

Rural land for sale (paid classifieds: $49 for 30 days) plus a directory of US land agents (free Basic, paid Verified). Astro (static output, zero client JS) served by Cloudflare Workers static assets; one tiny Worker handles the two forms. Listings are JSON files, so an AI agent can maintain them: see [UPDATING.md](UPDATING.md). Research, design and open decisions: [docs/BRIEF.md](docs/BRIEF.md).

## Develop

```sh
npm install
npm run dev            # includes demo listings
npm run check          # types + content schema (warns while PLACEHOLDER values remain)
npm test               # both form handlers, Verified expiry, land ad expiry and ordering
npm run build          # production build (demo listings excluded)
npm run build:demo     # build with demo listings
npm run check:wording  # after a build: no "verified" wording outside the Verified tier copy
npm run lighthouse     # after build:demo: mobile Lighthouse on home, agent and land pages and both forms
npm run preview        # build:demo + wrangler dev (forms work locally with .dev.vars test keys)
```

For the forms locally, copy `.dev.vars.example` to `.dev.vars` (Turnstile test keys).

## Deploy

Pushing to `main` deploys through Cloudflare **Workers Builds** (Worker `rurallandlistings` > Settings > Builds, connected to this repo). Build command: `npm run build:demo` while only demo listings exist, then `npm run build`. Deploy command: `npx wrangler deploy`. Manual: `npm run deploy` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set.

`.github/workflows/daily-rebuild.yml` calls a Workers Builds deploy hook once a day. That rebuild is what takes land ads down after `expiresOn` and drops an expired `verifiedUntil` to Basic, so set it up: create the hook (Worker > Settings > Builds > Deploy Hooks) and save its URL as the repo secret `DEPLOY_HOOK_URL`; until then the workflow skips.

One-time dashboard steps:
1. **Custom domain:** Worker > Settings > Domains & Routes > add the apex and `www`.
2. **Email Routing:** enable it on the zone and verify the submissions inbox (`hello@namefolio.co` by default) as a destination. The sender `submissions@rurallandlistings.com` must be on the zone.
3. **Turnstile:** create a widget for the domain; put the site key in `wrangler.jsonc` (`TURNSTILE_SITE_KEY`) and run `npx wrangler secret put TURNSTILE_SECRET`. Without the secret both forms fail closed.
4. **Payment:** both products are invoiced by email by default. If you switch to Stripe Payment Links ($49 land ad, $149 Verified agent), set them in `site.config.ts` with success URLs `/sell-your-land/` and `/listing-plans/`.
5. **AI Crawl Control:** make sure AI crawlers are allowed; optionally enable Markdown for Agents.

## Start the next domain from this repo

The engine (`src/lib`, `src/pages`, `src/components`, `src/views`, `src/styles`, `src/worker.ts`, `src/form.ts`, `src/land-form.ts`) holds no niche words. For a new site change only:

- `site.config.ts`: name, domain, placeholders, entity nouns, URL hubs, schema.org types, credential check, regions, attributes, taxonomies, card facts, FAQs and title templates, and the `classifieds` block (drop its pages if the next site has no classifieds).
- `src/theme.css`: palette, font and feel (and swap `public/fonts/`, `public/favicon.svg`).
- `docs/BRIEF.md`: the new keyword research and design direction.
- `src/content/listings/**` and `src/content/land/**`: the listing files (`npm run remove-demo`, then `npm run import-csv` for directory listings).
- `wrangler.jsonc` and `astro.config.mjs`: the Worker name and site URL.
