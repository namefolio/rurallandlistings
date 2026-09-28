import type { APIRoute } from 'astro';
import { site } from '../../site.config';
import { loadAll } from '../lib/data';
import { faqsMd, mdResponse, regionsIndexMd } from '../lib/markdown';

export const GET: APIRoute = async () => {
  const { regions, listings } = await loadAll();
  return mdResponse(`# ${site.titles.homeH1}

${site.tagline} ${listings.length} listings. Canonical URL: ${site.url}/

## Browse by ${site.regionNoun}

${regionsIndexMd(regions)}
${faqsMd(site.homeFaqs)}`);
};
