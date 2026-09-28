import type { APIRoute } from 'astro';
import { cityPaths, countyPaths } from '../../../../lib/pages';
import { cityMd, countyMd, faqsMd, mdResponse } from '../../../../lib/markdown';

export const getStaticPaths = async () => [...(await cityPaths()), ...(await countyPaths())];
export const GET: APIRoute = ({ props }) =>
  mdResponse(
    (props.kind === 'land' ? countyMd(props.region, props.county, props.intro, props.nearbyCounties) : cityMd(props.region, props.city, props.intro, props.nearbyCities)) +
      faqsMd(props.faqs),
  );
