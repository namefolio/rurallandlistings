import type { APIRoute } from 'astro';
import { regionPaths } from '../../../lib/pages';
import { mdResponse, regionMd } from '../../../lib/markdown';

export const getStaticPaths = regionPaths;
export const GET: APIRoute = ({ props }) => mdResponse(regionMd(props.region, props.intro));
