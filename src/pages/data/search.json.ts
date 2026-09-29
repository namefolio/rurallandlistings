import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { BUILD_DATE, searchItems } from '../../lib/data';

// Compact search index: what the daily saved-search alert job matches against (same rules as the search page).
export const GET: APIRoute = async () => {
  const states = Object.fromEntries(Object.entries(site.regions).filter(([, r]) => r.code).map(([slug, r]) => [slug, r.name]));
  const body = { generated: BUILD_DATE.toISOString(), items: await searchItems(), labels: { states, types: site.classifieds.landTypes, features: site.classifieds.featureFilters } };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
