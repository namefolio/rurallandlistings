import type { APIRoute } from 'astro';
import { site } from '../../../../site.config';
import { termPages } from '../../../lib/data';
import { listingTable, mdResponse } from '../../../lib/markdown';

export async function getStaticPaths() {
  return (await termPages()).map((page) => ({ params: { taxonomy: page.segment, term: page.term }, props: { page } }));
}
export const GET: APIRoute = ({ props }) =>
  mdResponse(`# ${props.page.title}\n\nCanonical URL: ${site.url}${props.page.url}\n\n${props.page.description}\n\n${listingTable(props.page.listings, true)}`);
