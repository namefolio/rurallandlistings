import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { adNotice } from '../../lib/copy';
import { loadAll, loadLand } from '../../lib/data';
import { landRegionsIndexMd, mdResponse, regionsIndexMd } from '../../lib/markdown';

export const getStaticPaths = () => [
  { params: { hub: site.hub }, props: { kind: 'agents' } },
  { params: { hub: site.classifieds.hub }, props: { kind: 'land' } },
];

export const GET: APIRoute = async ({ props }) => {
  if (props.kind === 'land') {
    const { regions } = await loadLand();
    return mdResponse(`# Rural land for sale by ${site.regionNoun}\n\n${adNotice}\n\n${landRegionsIndexMd(regions) || 'No land is listed right now.'}`);
  }
  const { regions } = await loadAll();
  return mdResponse(`# ${site.entity.Many} by ${site.regionNoun}\n\n${regionsIndexMd(regions)}`);
};
