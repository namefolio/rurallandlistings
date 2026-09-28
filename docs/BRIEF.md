# Brief: RuralLandListings.com

Market: **United States** (.com, "rural land" is US usage). Audience: (1) buyers looking for acreage, farms, ranches, hunting land and homesites by state and county; (2) owners and agents selling rural land; (3) buyers and sellers looking for a land agent.

Ben's product decision (2026-09-28): a classifieds site, not only a directory. Two paid products: a **$49 land listing that runs 30 days**, and a **$149 business listing for land agents**.

## Products and tiers (defaults we chose, confirm or change)

| Product | Price | How it works |
|---|---|---|
| Land for sale (classified) | $49 for 30 days | Paid only. Seller writes the ad; goes live after payment and a review; `expiresOn` = 30 days after going live; the daily rebuild removes it after that. Renew for another $49. Newest first, no paid placement, never tiered. |
| Land agent, Basic | Free | Directory listing from public sources or a submission. |
| Land agent, Verified | $149 **a year** (term is our default) | The spec's Verified tier: license check + agent confirmation, label, shown first. |

Why this split: agents keep the spec's free Basic + paid Verified model (so the agent directory fills from public data), and land ads are paid-only because a free land ad would be unmoderated classifieds. "Verified" is used only for agents; land ads are called "land listings" and say plainly that they are paid ads written by the seller and that we do not inspect land or check title.

## Launch values to confirm

All in `site.config.ts` (`PLACEHOLDERS`), copied from Ben's other directory sites because none were given:
- For-sale contact: `https://www.domainmarket.com/`
- Submissions inbox: `hello@namefolio.co` (also `wrangler.jsonc`)
- Payment: both products invoiced by email (`mailto:hello@namefolio.co`); swap in Stripe Payment Links when ready
- Verified term: "a year"

## Keywords → page types

No search volumes were available; none are claimed.

| Cluster | Examples | Page type |
|---|---|---|
| State | land for sale in {state}, {state} acreage for sale | `/land-for-sale/{state}/` |
| County | land for sale {county} county {ST} | `/land-for-sale/{state}/{county}/` (the place level land buyers use) |
| Land type | hunting land for sale, farmland for sale, ranches for sale, timberland, recreational, waterfront | `/{type}-for-sale/` (only with 3+ live ads) |
| Terms | owner financed land for sale | `/owner-financed-land/` (3+ ads) |
| Parcel | {acres} acres {town} | Land listing page |
| Sell | sell land by owner, list land for sale | `/sell-your-land/` |
| Agents | land agent / land broker {city}, farm and ranch realtor, ALC | `/land-agents/{state}/{city}/`, `/land-agents-for/{specialty}/` |

Evidence:
- **Who ranks:** LandWatch organises by state and by type (e.g. "United States Farms and Ranches for Sale", "California Land for Sale", landwatch.com); Land.com/Lands of America lead with "Ranches, Farms, and Land for Sale Near Me" (land.com). Comparison pieces list LandWatch, Land.com, LandSearch, Zillow, Facebook Marketplace and Craigslist as the channels (jerezland.com, reonomy.com, iqcalculators.com). Gap we fill: a cheap flat-fee, owner-friendly ad with the facts buyers ask about in a fixed table, plus a dated, disclosed agent directory; no ratings.
- **Buyer questions** (LandSearch "Questions You Should Ask When Buying Land"; AgWest Farm Credit land buying checklist; AgSouth Farm Credit; Land.com network): owner financing, buildable, survey, utilities/well/septic and perc test, zoning, HOA, road access, water features, mineral/water/timber rights, liens and deed restrictions, flood zone, easements, taxes. These became the land attributes, card facts and FAQs.
- **Agent credential:** real estate licenses are public in every state via the state commission lookup (ARELLO license verification, arello.org/arello.com; e.g. Alabama REC license search, Louisiana REC "Verify License"). Check wording: "we check the agent's real estate license with the state real estate commission's public license lookup, and confirm the details with the agent". The REALTORS® Land Institute's **Accredited Land Consultant (ALC)** designation is the land-specific credential and has a public "Find a Land Consultant" search (rliland.com; nar.realtor), so it is an attribute, not the Verified check.
- **schema.org:** agents `RealEstateAgent`; land ads `RealEstateListing` with an `Offer` (price, `validThrough` = `expiresOn`). No rating markup; nothing claims verification.

## Entities, URLs, attributes

- Land ad: "land listing". Hub `land-for-sale`, `{state}/{county}/{slug}`. County is the display name in the file ("Washington County"), so parishes and boroughs work.
- Agent: "land agent". Hub `land-agents`, `{state}/{city}/{slug}`.
- Land attributes: land type (farmland, ranch, pasture, hunting, timber, recreational, homesite, waterfront, undeveloped), owner financing, public road access, electric, well, creek/pond/spring, septic or perc, surveyed, mineral rights, deed restrictions, mobile homes allowed, buildings, annual tax. Always shown as the seller's claims.
- Land card facts: price (large), acres, price per acre, land type, owner financing, listed date.
- Agent attributes: specialties (farms and ranches, hunting and recreational, timberland, lots and homesites, land auctions, development), works with buyers, works with sellers, ALC.

## Titles

- County: "Land for Sale in {County}, {ST}: Acreage, Farms & Hunting Land | RuralLandListings"
- Land ad: "{Title}, {County} {ST} | Land for Sale"
- Agent city: "Land Agents in {City}, {ST}: Farm, Ranch & Hunting Land Brokers | RuralLandListings"
- Home: "Rural Land for Sale by Owner & Land Agents in the US | RuralLandListings"

## Design

- **Home layout:** location-led for land (state tiles, then counties), type tiles, newest ads, then agents by state, then "Selling land?", then FAQs. Primary button: "Sell your land: $49 for 30 days".
- **Feel:** county plat map. Field-cream paper, 1px survey-line rules, 8px radius, no shadows, forest-green accent for price, buttons, Verified rule and the H1 rule; creek-blue links. The asking price is the largest thing on every land card and ad.
- **Font:** Public Sans (variable, self-hosted WOFF2, OFL), 18px/1.6, 70ch.
- **Contrast** (WCAG ratios): ink/paper 14.3, muted/paper 6.9, accent/paper 8.3, link/paper 7.2, cream-on-green buttons 9.1, banner 14.3, form borders (rule/paper) 4.3, focus ring 5.0.

## Other defaults

- Land ads can hold up to 5 seller links (photos, survey, map); no uploads.
- Map link uses an approximate point, labelled as not a boundary.
- Changes during the paid period are free; renewals cost $49.
- Demo data: 3 demo agents (Brenham, TX) and 3 demo land ads (Washington County, TX) marked `demo: true`; the demo ads end between 2026-10-26 and 2026-10-28 and then drop off like real ones. `npm run remove-demo` removes both.
