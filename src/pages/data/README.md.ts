import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { mdResponse } from '../../lib/markdown';

const c = site.classifieds;

export const GET: APIRoute = () =>
  mdResponse(`# ${site.name} data files

Read-only JSON, regenerated on every build (at least daily).

## ${site.entity.Many}

- \`/data/listings.json\`: every published ${site.entity.one} listing.
- \`/data/{${site.regionNoun}}/{city}.json\`: ${site.entity.many} in one city, in display order (Verified first, then Basic; each by completeness, then name).

Fields:

- \`name\`, \`slug\`, \`url\` (canonical page), \`region\`, \`city\` (URL slugs)
- \`tier\`: \`basic\` (free; details from public sources or a submission) or \`verified\` (paid; ${site.credential.name} checked with ${site.credential.source} and details confirmed by the ${site.entity.one}). An expired Verified listing is published as \`basic\`.
- \`verifiedUntil\`: date the Verified plan runs to, or null
- \`address\` (street, city, region, postalCode), \`lat\`, \`lng\`, \`phone\`, \`website\`, \`sameAs\`
- \`hours\`: per weekday (\`mon\`…\`sun\`), "HH:MM-HH:MM" ranges separated by commas, or "closed"; a missing day is unknown
- \`summary\`: 1–2 factual sentences; \`description\` and \`bookingUrl\`: from the ${site.entity.one}, Verified only
- \`attributes\`: ${site.attributes.map((a) => `\`${a.key}\` (${a.label.toLowerCase()})`).join(', ')}; a missing key is unknown
- \`lastUpdated\`: date the details were last checked or changed; \`source\`: where they came from

## ${c.entity.Many} (land for sale)

- \`/data/land.json\`: every live ${c.entity.one}, newest first.
- \`/data/land/{${site.regionNoun}}/{${c.placeNoun}}.json\`: live ${c.entity.many} in one ${c.placeNoun}.

These are paid ads written by the seller, each live for ${c.days} days per payment. Only live ads are published; an ad leaves the files on the first build after \`expiresOn\`.

Fields:

- \`title\`, \`slug\`, \`url\`, \`region\`, \`county\` (URL slugs); \`location\` (county name, state code, nearestTown, postalCode)
- \`lat\`, \`lng\`: the seller's approximate point, never a boundary
- \`acres\`; \`price\`: asking price in USD, or null for "price on request"
- \`seller\`: \`type\` (owner or agent), \`name\`, \`phone\`, \`email\`, \`agentSlug\` (the agent's listing, if any)
- \`summary\`: the seller's own description; \`links\`: the seller's photo, survey or map links
- \`attributes\`: ${c.attributes.map((a) => `\`${a.key}\` (${a.label.toLowerCase()})`).join(', ')}; a missing key is unknown. All are the seller's own claims.
- \`postedOn\`, \`expiresOn\`: the paid period; \`lastUpdated\`; \`source\``);
