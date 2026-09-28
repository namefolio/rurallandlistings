import type { APIRoute } from 'astro';
import { site } from '../../site.config';
import { aboutListings, price } from '../lib/copy';
import { loadAll } from '../lib/data';
import { regionsIndexMd } from '../lib/markdown';

export const GET: APIRoute = async () => {
  const { regions, listings } = await loadAll();
  return new Response(
    `# ${site.name}

> ${site.tagline} An independent directory of ${listings.length} ${site.entity.many}. No ratings, reviews or referral fees.

## How data is sourced

Details come from each ${site.entity.one}'s own website and social pages, or from submissions. Every listing shows its source and the date it was last updated. Unknown facts are left out, never guessed.

## Basic and Verified

${aboutListings.join('\n\n')} Verified costs ${price}. Paying never changes the facts shown.

## Locations

${regionsIndexMd(regions)}

## Data

- [All listings (JSON)](${site.url}/data/listings.json)
- [Data field guide](${site.url}/data/README.md)
- [Every listing as text](${site.url}/llms-full.txt)
- Per-city JSON: ${site.url}/data/{${site.regionNoun}}/{city}.json
- Every page has a markdown twin at {url}index.md

## Pages

- [Listing plans](${site.url}/listing-plans/)
- [About and sources](${site.url}/about/)
- [Add or update a listing](${site.url}/add-your-business/)
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
