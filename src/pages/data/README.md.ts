import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { mdResponse } from '../../lib/markdown';

export const GET: APIRoute = () =>
  mdResponse(`# ${site.name} data files

Read-only JSON, regenerated on every build (at least daily).

- \`/data/listings.json\`: every published listing.
- \`/data/{${site.regionNoun}}/{city}.json\`: listings for one city, in display order (Verified first, then Basic; each by completeness, then name).

## Fields

- \`name\`, \`slug\`, \`url\` (canonical page), \`region\`, \`city\` (URL slugs)
- \`tier\`: \`basic\` (free; details from public sources or a submission) or \`verified\` (paid; ${site.credential.name} checked with ${site.credential.source} and details confirmed by the owner). An expired Verified listing is published as \`basic\`.
- \`verifiedUntil\`: date the Verified plan runs to, or null
- \`address\` (street, city, region, postalCode), \`lat\`, \`lng\`, \`phone\`, \`website\`, \`sameAs\`
- \`hours\`: per weekday (\`mon\`…\`sun\`), "HH:MM-HH:MM" ranges separated by commas, or "closed"; a missing day is unknown
- \`summary\`: 1–2 factual sentences; \`description\` and \`bookingUrl\`: from the owner, Verified only
- \`attributes\`: ${site.attributes.map((a) => `\`${a.key}\` (${a.label.toLowerCase()})`).join(', ')}; a missing key is unknown
- \`lastUpdated\`: date the details were last checked or changed; \`source\`: where they came from`);
