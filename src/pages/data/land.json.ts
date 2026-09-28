import type { APIRoute } from 'astro';
import { BUILD_DATE, loadLand } from '../../lib/data';
import { json, publicLand } from '../../lib/public';

export const GET: APIRoute = async () => {
  const { land } = await loadLand();
  return json({ generated: BUILD_DATE.toISOString(), count: land.length, listings: land.map(publicLand) });
};
