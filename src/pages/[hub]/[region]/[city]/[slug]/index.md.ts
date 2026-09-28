import type { APIRoute } from 'astro';
import { listingPaths } from '../../../../../lib/pages';
import { listingMd, mdResponse } from '../../../../../lib/markdown';

export const getStaticPaths = listingPaths;
export const GET: APIRoute = ({ props }) => mdResponse(listingMd(props.listing, props.faqs, props.nearby));
