import type { APIRoute } from 'astro';
import { BUILD_DATE, loadLand } from '../../../../lib/data';
import { json, publicLand } from '../../../../lib/public';

export async function getStaticPaths() {
  const { regions } = await loadLand();
  return regions.flatMap((r) => r.counties.map((k) => ({ params: { region: r.slug, county: k.countySlug }, props: { county: k } })));
}
export const GET: APIRoute = ({ props }) =>
  json({ generated: BUILD_DATE.toISOString(), county: props.county.name, count: props.county.listings.length, listings: props.county.listings.map(publicLand) });
