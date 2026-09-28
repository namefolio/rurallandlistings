import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { landCategoryPages } from '../../lib/data';
import { landTable, mdResponse } from '../../lib/markdown';

export async function getStaticPaths() {
  return (await landCategoryPages()).map((page) => ({ params: { category: page.slug }, props: { page } }));
}
export const GET: APIRoute = ({ props }) =>
  mdResponse(`# ${props.page.title}\n\nCanonical URL: ${site.url}${props.page.url}\n\n${site.classifieds.titles.categoryDescription(props.page.noun, props.page.listings.length)}\n\n${landTable(props.page.listings, true)}`);
