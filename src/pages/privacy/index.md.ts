import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { mdResponse } from '../../lib/markdown';

export const GET: APIRoute = () =>
  mdResponse(`# Privacy

${site.name} sets no cookies and runs no analytics or advertising scripts. Form submissions are emailed and not stored on the site; the submitter's own name and email are never published. On a land ad, the seller contact details entered for buyers are published until the ad ends. The forms use Cloudflare Turnstile to block spam. Hosting is on Cloudflare.`);
