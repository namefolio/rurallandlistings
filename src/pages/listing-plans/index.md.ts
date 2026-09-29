import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { basicBullets, howToSteps, payLabel, payLink, plansFaqs, plansIntro, price, verifiedBullets } from '../../lib/copy';
import { faqsMd, mdResponse } from '../../lib/markdown';

export const GET: APIRoute = () =>
  mdResponse(`# Land agent profiles: Basic (free) or Verified

${plansIntro}

## Basic: Free

${basicBullets.map((b) => `- ${b}`).join('\n')}

## Verified: ${price}

${verifiedBullets.map((b) => `- ${b}`).join('\n')}

## How to get a Verified listing

${howToSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

- Send your ${site.entity.one}’s details: ${site.url}/add-your-business/?tier=verified
- ${payLabel}: ${payLink}
${faqsMd(plansFaqs)}`);
