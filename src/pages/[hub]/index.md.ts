import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { loadAll } from '../../lib/data';
import { mdResponse, regionsIndexMd } from '../../lib/markdown';

export const getStaticPaths = () => [{ params: { hub: site.hub } }];

export const GET: APIRoute = async () => {
  const { regions } = await loadAll();
  return mdResponse(`# ${site.entity.Many} by ${site.regionNoun}\n\n${regionsIndexMd(regions)}`);
};
