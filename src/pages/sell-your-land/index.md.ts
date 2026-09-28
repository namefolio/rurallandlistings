import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { adNotice, classifiedPayLabel, classifiedPayLink, classifiedTerm, sellFaqs, sellSteps } from '../../lib/copy';
import { faqsMd, mdResponse } from '../../lib/markdown';

export const GET: APIRoute = () =>
  mdResponse(`# Sell your land: ${classifiedTerm}

Owners and agents can list rural land for sale on ${site.name}. ${adNotice}

## How it works

${sellSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

- Form: ${site.url}/sell-your-land/ (add ?listing={slug} to renew or change a listing; it needs a browser, as it uses Cloudflare Turnstile)
- ${classifiedPayLabel}: ${classifiedPayLink}

Fields: headline, state, county, nearest town, ZIP, acres, asking price, description, links, ${site.classifieds.attributes.map((a) => a.label.toLowerCase()).join(', ')}, the public seller name, phone and email, and the submitter's private name and email.
${faqsMd(sellFaqs)}`);
