import type { APIRoute } from 'astro';
import { landPaths, listingPaths } from '../../../../../lib/pages';
import { landMd, listingMd, mdResponse } from '../../../../../lib/markdown';

export const getStaticPaths = async () => [...(await listingPaths()), ...(await landPaths())];
export const GET: APIRoute = ({ props }) =>
  mdResponse(props.kind === 'land' ? landMd(props.land, props.faqs, props.nearby, props.agent) : listingMd(props.listing, props.faqs, props.nearby));
