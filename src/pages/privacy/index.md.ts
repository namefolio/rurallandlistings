import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { mdResponse } from '../../lib/markdown';

export const GET: APIRoute = () =>
  mdResponse(`# Privacy

${site.name} sets no cookies and runs no analytics or advertising scripts. Form submissions are emailed and not stored on the site; submitter contact details are never published. The form uses Cloudflare Turnstile to block spam. Hosting is on Cloudflare.`);
