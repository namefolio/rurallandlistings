import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { price } from '../../lib/copy';
import { mdResponse } from '../../lib/markdown';

export const GET: APIRoute = () =>
  mdResponse(`# Add or update a ${site.entity.one}

Send a new ${site.entity.one} or a correction with the form at ${site.url}/add-your-business/ (add ?listing={slug} to update an existing listing). Basic listings are free. Verified costs ${price} and is for owners and staff only: see ${site.url}/listing-plans/.

The form needs a browser (it uses Cloudflare Turnstile). Fields: business name, address, phone, website, social links, description, hours, ${site.attributes.map((a) => a.label.toLowerCase()).join(', ')}, and the submitter's name, email and relationship to the business.`);
