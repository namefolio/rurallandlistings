import type { APIRoute } from 'astro';
import { site } from '../../site.config';
import { adNotice, classifiedTerm } from '../lib/copy';
import { loadAll, loadLand } from '../lib/data';
import { faqsMd, landRegionsIndexMd, mdResponse, regionsIndexMd } from '../lib/markdown';

export const GET: APIRoute = async () => {
  const { regions, listings } = await loadAll();
  const { regions: landRegions, land } = await loadLand();
  return mdResponse(`# ${site.titles.homeH1}

${site.tagline} ${land.length} land listings and ${listings.length} ${site.entity.many}. Canonical URL: ${site.url}/

${adNotice} Sell your land (${classifiedTerm}): ${site.url}/sell-your-land/

## Land for sale by ${site.regionNoun}

${landRegionsIndexMd(landRegions) || 'No land is listed right now.'}

## ${site.entity.Many} by ${site.regionNoun}

${regionsIndexMd(regions) || 'No agents are listed yet.'}
${faqsMd(site.homeFaqs)}`);
};
