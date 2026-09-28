import type { APIRoute } from 'astro';
import { cityPaths } from '../../../../lib/pages';
import { cityMd, faqsMd, mdResponse } from '../../../../lib/markdown';

export const getStaticPaths = cityPaths;
export const GET: APIRoute = ({ props }) => mdResponse(cityMd(props.region, props.city, props.intro, props.nearbyCities) + faqsMd(props.faqs));
