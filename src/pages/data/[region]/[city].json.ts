import type { APIRoute } from 'astro';
import { BUILD_DATE, loadAll } from '../../../lib/data';
import { json, publicListing } from '../../../lib/public';

export async function getStaticPaths() {
  const { regions } = await loadAll();
  return regions.flatMap((r) => r.cities.map((c) => ({ params: { region: r.slug, city: c.citySlug }, props: { city: c } })));
}
export const GET: APIRoute = ({ props }) =>
  json({ generated: BUILD_DATE.toISOString(), city: props.city.name, count: props.city.listings.length, listings: props.city.listings.map(publicListing) });
