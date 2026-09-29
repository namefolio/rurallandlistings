# Updating listings (for AI agents)

Two kinds of file. **Land agents**: `src/content/listings/{state}/{city}/{slug}.json` (schema `listingSchema`). **Land for sale** (paid ads): `src/content/land/{state}/{county}/{slug}.json` (schema `landSchema`, county folder like `washington-county`). Schemas are in `src/lib/schema.ts`; attribute keys and allowed values in `site.config.ts`. A bad file fails the build, never the live site. Never invent agents, parcels, prices, reviews or ratings.

## Land for sale (paid, 30 days)
- **Add only after the site owner confirms the $49 payment.** Use the email's JSON: set `postedOn` to the day it goes live and `expiresOn` 30 days later, `lastUpdated` today. Fill `lat`/`lng` with an approximate point near the named town or road (never a boundary) and drop `null` values. Keep the seller's own words in `summary`; fix only typos.
- Check for an existing ad with the same title, county and seller phone/email first.
- **Renewal** (after payment): set `expiresOn` to 30 days after the later of today and the current `expiresOn`; apply any changed fields; update `lastUpdated`.
- **Change**: apply changed fields only; leave `postedOn`/`expiresOn` alone.
- **Sold or withdrawn**: set `status` to `"sold"` or `"withdrawn"`. Expired ads drop off on the next daily build; delete their files monthly.
- **Photos** come as `photos: [{id, alt, kind, width, height}]` (uploaded to R2; the email has private review links valid 14 days). Look at them before publishing; remove any that are not of the land or show private information. Photos go public only when a published file lists them. `videoUrl` (YouTube/Vimeo) is optional. Keep `exactLocation: true` only if the seller ticked it; otherwise the map shows an area, never the point.
- Never copy the submitter's private name or email into the file (only the seller contact they chose to publish). If the seller is a listed agent, set `seller.agentSlug`.

## Land agents: add, edit, remove
1. Search for an existing listing by name + postal code + phone (`grep -ril "<name>" src/content/listings`); if found, edit it.
2. New file: `slug` equals the file name and is unique; `status: "published"`, `tier: "basic"`, `lastUpdated` today, `source` = where the facts came from. `summary`: 1–2 factual third-person sentences. Leave unknowns out. Bulk: `npm run import-csv -- file.csv`.
3. Edit: change fields, set `lastUpdated`, update `source`. Close: `status: "closed"`. Remove: delete the file. Demo data (both kinds): `npm run remove-demo`.

## Handling a submission email
- `[… ] Land listing · …` emails: follow "Land for sale" above. `[… ] Basic|Verified request · …` emails: land agents.
- Agent emails hold a listing-shaped JSON block; with an `Update:` subject, edit that slug. Never publish the submitter's name, email or relationship. Keep `tier: "basic"`, even for a Verified request, until the site owner says payment is received and ownership is confirmed.

Agent profile fields: `brokerage`, `agentType` (agent, broker, auctioneer, consultant), public `email`, `photo` (one uploaded photo), `licenses: [{state, number}]`, `countiesServed: [{state, county}]`. Drop `null` values from the email's JSON.

## Upgrading an agent to Verified (only on the site owner's word)
1. Look up each license in `licenses` with that state's real estate commission. Record only states whose license you found active.
2. Set `tier: "verified"`, `verifiedUntil` one year from today (unless told otherwise), and `licenseCheck: { checkedOn: "<today>", states: ["TX", ...] }`. The build fails a Verified profile without `licenseCheck`; the profile shows those states and that date.
3. Add the agent's `description` (≤150 words) and `bookingUrl`, set `lastUpdated`.
Downgrade: `tier: "basic"`, remove `verifiedUntil`, `licenseCheck`, `description` and `bookingUrl`.

## Check, commit, push
```sh
npm run check && npm test && npm run build
git add -A && git commit -m "Listings: <what changed>" && git push origin main
```
Pushing to `main` deploys the site (Workers Builds).
