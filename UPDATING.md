# Updating listings (for AI agents)

Listings are JSON files at `src/content/listings/{region}/{city}/{slug}.json` (region = state slug like `texas`, city like `austin`). The schema is `src/lib/schema.ts`; attribute keys and allowed values are in `site.config.ts`. A bad file fails the build, never the live site.

## Add
1. Search for an existing listing with the same name + postal code + phone (`grep -ril "<name>" src/content/listings`). If found, edit it instead.
2. Create the file. `slug` must equal the file name and be unique site-wide. Set `status: "published"`, `tier: "basic"`, `lastUpdated` to today, `source` to where the facts came from.
3. `summary`: 1–2 factual third-person sentences. Leave unknown fields out; never invent hours, prices, reviews or ratings.
4. Bulk: `npm run import-csv -- file.csv` (dedupes on name + postal code + phone).

## Edit
Change the fields, set `lastUpdated` to today, and update `source` if the facts came from somewhere new.

## Close or remove
Closed for good: set `status: "closed"` (drops it from the site). Remove entirely: delete the file. Demo data: `npm run remove-demo`.

## Handling a submission email
- The email holds a JSON block shaped like a listing file. Check for an existing listing by name + postal code + phone first; with an `Update:` subject, edit the listing with that slug.
- Never copy the submitter's name, email or relationship into the public file.
- Fill in `lat`/`lng` from the address and write a factual `summary`; drop `null` values.
- Keep `tier: "basic"`, even for a "Verified request", until the site owner says payment is received and ownership is confirmed. A submission alone never makes a listing Verified.

## Upgrading to Verified (only on the site owner's word)
Set `tier: "verified"` and `verifiedUntil` one year from today (unless told otherwise), add the owner's `description` (≤150 words) and `bookingUrl`, and set `lastUpdated` to today.

## Downgrading
Set `tier: "basic"` and remove `verifiedUntil`, `description` and `bookingUrl`. (An expired `verifiedUntil` already renders as Basic on the next daily build.)

## Check, commit, push
```sh
npm run check && npm test && npm run build
git add -A && git commit -m "Listings: <what changed>" && git push origin main
```
Pushing to `main` deploys the site (Workers Builds).
