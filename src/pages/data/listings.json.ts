import type { APIRoute } from 'astro';
import { BUILD_DATE, loadAll } from '../../lib/data';
import { json, publicListing } from '../../lib/public';

export const GET: APIRoute = async () => {
  const { listings } = await loadAll();
  return json({ generated: BUILD_DATE.toISOString(), count: listings.length, listings: listings.map(publicListing) });
};
