# Brief: TattooStudioGuide.com

Market: **United States** (confirmed by the owner, 2026-09-28). Audience: adults choosing a tattoo shop in their city, usually by style and by whether the shop takes walk-ins.

## Keywords → page types

Domain words: tattoo, studio, guide, .com (US market confirmed by owner).

| Cluster | Examples | Page type |
|---|---|---|
| Place | tattoo shops in {city} {ST}, tattoo shops near me, tattoo {city} | City page `/tattoo-shops/{state}/{city}/` |
| State | tattoo shops in {state} | State page `/tattoo-shops/{state}/` |
| Walk-in / urgency | walk in tattoo shops {city}, tattoo shops open now | "Walk-ins" best-for section on city pages; `/services/walk-ins/` |
| Style | fine line tattoo {city}, traditional, realism, blackwork, Japanese | `/styles/{style}/` (only with 3+ listings) |
| Named shop | {shop name} {city} | Listing page `/tattoo-shops/{state}/{city}/{slug}/` |
| Questions | cost, minimum, deposit, age/ID, walk-ins | FAQs on listing, city and home pages |

Evidence (no search volumes were available; none are claimed):
- **Entity noun "tattoo shop".** Yelp's US category and search pages use "Tattoo Shops" (yelp.com search for Houston, Denver, Bozeman, Saint Paul); US listicles use "tattoo shops" (do303.com "Denver's Top Tattoo Shops"); many US shops call themselves "tattoo shop" (ritualtattoogallery.com, nyctattooshop.com). "Studio" is the brand word, so titles pair them: "Tattoo Shops & Studios in {City}, {ST}".
- **Location modifiers:** "near me" and "in {city}, {ST}" forms dominate Yelp and shop pages; the city is the level people choose at; state is the hub level. Neighborhoods are left for later, when big cities have enough listings.
- **Walk-ins matter:** Yelp has dedicated "Tattoo Shops Walk Ins" pages per city; many shops lead with "Walk-ins welcome" (livebytheswordtattoo.com, rabblerousertattoo.com, chitowntattoo.com).
- **Styles:** US shops advertise fine line, traditional, realism, blackwork etc. (noregrets.tattoo, tatship.com style lists).
- **Common questions** (shop FAQ pages, e.g. clubtattoo.com/pages/faqs, bayinktattoo.com/faq, sortra.com on deposits): how much does it cost / shop minimum, deposit, walk-ins or appointment, ID and age (18+, some allow 16+ with parental consent by state), cover-ups, bring your own design, aftercare.
- **Who ranks now** (Houston TX = large, Denver CO = mid, Bozeman MT = small): Yelp everywhere; editorial listicles (Westword, do303) in Denver; shop sites and Facebook pages in Bozeman. Gaps: listicles give no hours, walk-in policy, minimums or license info (do303 checked); Yelp mixes ratings with ads. Nobody states when details were last checked.
- **Credential:** US tattoo shops are licensed by the state or local health department, and several states publish a free lookup (Texas DSHS public license search; Florida DOH establishment licensing; Minnesota MDH body art licenses). Check wording: "we check the shop's tattoo establishment license with the state or local health department that issues it, and confirm the details with the owner".
- **schema.org type:** `TattooParlor`.

## URLs and entity

- Entity noun: tattoo shop / tattoo shops. Hub segment: `tattoo-shops`. Region = US state (slug `texas`), city slug `houston`. Titles use the two-letter state code.
- Taxonomies: `styles` (fine-line, traditional, neo-traditional, realism, blackwork, japanese, black-and-grey, color, lettering, geometric, watercolor, portraits) and `services` (walk-ins, piercing, cover-ups, custom-designs, laser-removal).

## Listing attributes (schema)

`styles[]`, `services[]` (walk-ins, piercing, cover-ups, custom-designs, laser-removal), `appointmentOnly` (bool), `minimumCharge` (USD number, only when the shop publishes it), `depositRequired` (bool), `minAge` (number, from the shop's own policy), `veganInk` (bool), `wheelchairAccessible` (bool), `cardsAccepted` (bool). Unknown = omitted, shown as "Not listed".

**Card facts (max 5):** top 3 styles · walk-ins yes/no · shop minimum · open Sundays · piercing.

## Title / meta templates

- Home: `Tattoo Shops & Studios in the US by City and Style | TattooStudioGuide` · "Find tattoo shops by state, city and style. Hours, walk-ins, shop minimums and how to book, with the date each listing was last checked."
- State: `Tattoo Shops in {State}: {n} Studios by City | TattooStudioGuide`
- City: `Tattoo Shops in {City}, {ST}: Walk-ins, Styles & Hours | TattooStudioGuide` · "{n} tattoo shops in {City}, {ST}. Compare styles, walk-in policy, shop minimums and opening hours."
- Listing: `{Name}, {City} {ST}: Tattoo Shop Hours, Styles & Walk-ins`
- Style: `{Style} Tattoo Shops in the US | TattooStudioGuide`

## FAQs

- Listing (from data only): Does {name} take walk-ins? What styles does {name} tattoo? What is the shop minimum? Is {name} open on Sundays? Does {name} do piercings?
- City: How many tattoo shops are in {city}? Which take walk-ins? Which are open Sundays?
- Home: How much does a tattoo cost? (we only show a shop's minimum when it publishes one) · Do I need ID? (shops set age policy; most require 18+ with photo ID) · What does Verified mean?

## Design direction

- **Home layout: location-led.** Order: H1 + one line → states with listings (city links under each) → "Browse by style" tiles → "Walk-in shops" line → how listings work (Basic / Verified, one paragraph) → FAQs.
- **Feel:** flash-sheet print. Paper background, ink-black text, 2px ink borders, 4px corners, no shadows. **One accent treatment:** traditional-tattoo red used for a thick left rule (Verified cards, H1 underline bar) and primary buttons.
- **Palette** (checked AA, see `src/theme.css`): ink `#16130f`, paper `#fbf8f2`, red `#a4241c`, teal `#0d5c55` (links), muted `#57514a`, rule `#16130f`. Banner: paper on ink.
- **Font:** Atkinson Hyperlegible Next (variable WOFF2, self-hosted, OFL), 18px/1.6, 70ch measure; headings in the same family at weight 800.
- **Density:** medium; cards as bordered boxes with the 3–5 facts in a definition list.

## Defaults picked (no answer yet)

- Listings: no CSV provided yet → 3 demo shops in Austin, TX (`demo: true`, excluded from production).
- Placeholders in `site.config.ts` for the for-sale contact, submissions email, Verified price and payment link.
