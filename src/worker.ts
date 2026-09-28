// Handles only the two forms (agents, land) and their pay pages. Everything else is served straight from static assets (see wrangler.jsonc).
import { EmailMessage } from 'cloudflare:email';
import { handleSubmission, rawEmail, type FormDeps } from './form';
import { handleLandSubmission } from './land-form';
import { classifiedPayFor, payLinkFor } from './lib/copy';

interface Env {
  ASSETS: Fetcher;
  SUBMISSIONS: SendEmail;
  SUBMISSIONS_TO: string;
  FORM_FROM: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
}

async function verifyTurnstile(secret: string | undefined, token: string, ip: string | null) {
  if (!secret) return false; // fail closed without keys
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  return r.ok && ((await r.json()) as { success?: boolean }).success === true;
}

/** Fills the static form from the query string, so the page itself needs no JavaScript. */
async function formPage(request: Request, env: Env) {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(request);
  const slug = url.searchParams.get('listing') ?? '';
  let name = '';
  if (/^[a-z0-9-]{1,120}$/.test(slug)) {
    const data = (await (await env.ASSETS.fetch(new URL('/data/listings.json', url))).json()) as { listings: { slug: string; name: string }[] };
    name = data.listings.find((l) => l.slug === slug)?.name ?? '';
  }
  const verified = url.searchParams.get('tier') === 'verified';
  return new HTMLRewriter()
    .on('input[name="listing"]', { element: (e) => { if (name) e.setAttribute('value', slug); } })
    .on('#update-note', { element: (e) => { if (name) e.removeAttribute('hidden'); } })
    .on('#update-name', { element: (e) => { if (name) e.setInnerContent(name); } })
    .on('input[name="name"]', { element: (e) => { if (name) e.setAttribute('value', name); } })
    .on('input[name="tier"]', {
      element: (e) => {
        if (!verified) return;
        if (e.getAttribute('value') === 'verified') e.setAttribute('checked', '');
        else e.removeAttribute('checked');
      },
    })
    .on('.cf-turnstile', { element: (e) => { e.setAttribute('data-sitekey', env.TURNSTILE_SITE_KEY ?? ''); } })
    .transform(page);
}

/** Fills the sell form for a renewal or change of ?listing={slug}; otherwise it stays a new listing. */
async function sellPage(request: Request, env: Env) {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(request);
  const slug = url.searchParams.get('listing') ?? '';
  let title = '';
  if (/^[a-z0-9-]{1,120}$/.test(slug)) {
    const data = (await (await env.ASSETS.fetch(new URL('/data/land.json', url))).json()) as { listings: { slug: string; title: string }[] };
    title = data.listings.find((l) => l.slug === slug)?.title ?? '';
  }
  const rw = new HTMLRewriter().on('.cf-turnstile', { element: (e) => { e.setAttribute('data-sitekey', env.TURNSTILE_SITE_KEY ?? ''); } });
  if (!title) return rw.transform(page);
  return rw
    .on('input[name="listing"]', { element: (e) => { e.setAttribute('value', slug); } })
    .on('#update-note', { element: (e) => { e.removeAttribute('hidden'); } })
    .on('#update-name', { element: (e) => { e.setInnerContent(title); } })
    .on('input[name="title"]', { element: (e) => { e.setAttribute('value', title); } })
    .on('[data-new-only]', { element: (e) => { e.removeAttribute('required'); } })
    .on('input[name="request"]', {
      element: (e) => {
        const v = e.getAttribute('value');
        if (v === 'new') { e.removeAttribute('checked'); e.setAttribute('disabled', ''); }
        else e.removeAttribute('disabled');
        if (v === 'renew') e.setAttribute('checked', '');
      },
    })
    .transform(page);
}

/** Adds the land listing's title to the payment link as a reference. */
async function sellThanks(request: Request, env: Env) {
  const ref = (new URL(request.url).searchParams.get('ref') ?? '').slice(0, 120);
  const page = await env.ASSETS.fetch(request);
  if (!ref) return page;
  return new HTMLRewriter().on('#pay', { element: (e) => { e.setAttribute('href', classifiedPayFor(ref)); } }).transform(page);
}

/** Adds the business name to the payment link as a reference. */
async function thanksVerified(request: Request, env: Env) {
  const ref = (new URL(request.url).searchParams.get('ref') ?? '').slice(0, 120);
  const page = await env.ASSETS.fetch(request);
  if (!ref) return page;
  return new HTMLRewriter().on('#pay', { element: (e) => { e.setAttribute('href', payLinkFor(ref)); } }).transform(page);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const deps: FormDeps = {
      verifyTurnstile: (token, ip) => verifyTurnstile(env.TURNSTILE_SECRET, token, ip),
      send: async (m) => {
        await env.SUBMISSIONS.send(new EmailMessage(m.from, m.to, rawEmail(m, crypto.randomUUID())));
      },
      to: env.SUBMISSIONS_TO,
      from: env.FORM_FROM,
    };
    const read = request.method === 'GET' || request.method === 'HEAD';
    if (pathname === '/add-your-business/' && request.method === 'POST') return handleSubmission(request, deps);
    if (pathname === '/sell-your-land/' && request.method === 'POST') return handleLandSubmission(request, deps);
    if (pathname === '/sell-your-land/' && read) return sellPage(request, env);
    if (pathname === '/sell-your-land/thanks/') return sellThanks(request, env);
    if (pathname === '/add-your-business/' && read) return formPage(request, env);
    if (pathname === '/add-your-business/thanks-verified/') return thanksVerified(request, env);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
