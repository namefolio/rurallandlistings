import type { APIRoute } from 'astro';
import { landRegionPaths, regionPaths } from '../../../lib/pages';
import { landRegionMd, mdResponse, regionMd } from '../../../lib/markdown';

export const getStaticPaths = async () => [...(await regionPaths()), ...(await landRegionPaths())];
export const GET: APIRoute = ({ props }) =>
  mdResponse(props.kind === 'land' ? landRegionMd(props.region, props.intro) : regionMd(props.region, props.intro));
