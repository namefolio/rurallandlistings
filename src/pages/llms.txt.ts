import type { APIRoute } from 'astro';
import { site } from '../../site.config';
import { aboutListings, adNotice, classifiedTerm, price } from '../lib/copy';
import { loadAll, loadLand } from '../lib/data';
import { landRegionsIndexMd, regionsIndexMd } from '../lib/markdown';

const c = site.classifieds;

export const GET: APIRoute = async () => {
  const { regions, listings } = await loadAll();
  const { regions: landRegions, land } = await loadLand();
  return new Response(
    `# ${site.name}

> ${site.tagline} ${land.length} live ${c.entity.many} and ${listings.length} ${site.entity.many}. No ratings, reviews or referral fees.

## Land for sale (classifieds)

${adNotice} Only live ads are published; each runs ${c.days} days per payment and is removed on the first build after its end date. Asking prices, acreage and features are the seller's own claims. Sell your land (${classifiedTerm}): ${site.url}/sell-your-land/

${landRegionsIndexMd(landRegions) || 'No land is listed right now.'}

## ${site.entity.Many}: Basic and Verified

Basic ${site.entity.one} details come from each agent's own website and public pages, or from submissions. Every listing shows its source and the date it was last updated. Unknown facts are left out, never guessed.

${aboutListings.join('\n\n')} Verified costs ${price}. Paying never changes the facts shown.

${regionsIndexMd(regions) || 'No agents are listed yet.'}

## Data

- [All live land listings (JSON)](${site.url}/data/land.json)
- [All ${site.entity.one} listings (JSON)](${site.url}/data/listings.json)
- [Data field guide](${site.url}/data/README.md)
- [Every listing as text](${site.url}/llms-full.txt)
- Per-${c.placeNoun} land JSON: ${site.url}/data/land/{${site.regionNoun}}/{${c.placeNoun}}.json
- Per-city agent JSON: ${site.url}/data/{${site.regionNoun}}/{city}.json
- Every page has a markdown twin at {url}index.md

## Pages

- [Sell your land](${site.url}/sell-your-land/)
- [Agent listing plans](${site.url}/listing-plans/)
- [About and sources](${site.url}/about/)
- [Add or update an agent listing](${site.url}/add-your-business/)
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
