// The Worker: the two forms and their pay pages, photo uploads (R2), photo serving, saved-search alerts (D1 +
// Email Service) and the daily alert job. Every other request is served straight from static assets.
import { EmailMessage } from 'cloudflare:email';
import { handleSubmission, rawEmail, type FormDeps } from './form';
import { handleLandSubmission } from './land-form';
import { classifiedPayFor, payLinkFor } from './lib/copy';
import type { Labels, SearchItem } from './lib/search';
import { confirmOrUnsubscribe, createSavedSearch, runAlerts, unsubscribePost, type AlertDeps, type Mailer } from './saved-searches';
import { checkFormPhotos, checkSession, createSession, putPhoto, servePhoto, type UploadDeps } from './uploads';

interface Env {
  ASSETS: Fetcher;
  SUBMISSIONS: SendEmail;
  SUBMISSIONS_TO: string;
  FORM_FROM: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  /** Signs upload sessions; falls back to TURNSTILE_SECRET so no extra secret is required. */
  UPLOAD_SECRET?: string;
  PHOTOS?: R2Bucket;
  DB?: D1Database;
  /** Email Service binding for saved-search alerts (any recipient; the sender domain must be onboarded). */
  ALERTS?: SendEmail;
  ALERTS_FROM?: string;
}

async function verifyTurnstile(secret: string | undefined, token: string, ip: string | null) {
  if (!secret || !token) return false; // fail closed without keys
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  return r.ok && ((await r.json()) as { success?: boolean }).success === true;
}

const asset = (env: Env, path: string) => env.ASSETS.fetch(new Request(new URL(path, 'https://assets.local')));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Fills the static form from the query string, so the page itself needs no JavaScript. */
async function formPage(request: Request, env: Env) {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(request);
  const slug = url.searchParams.get('listing') ?? '';
  let name = '';
  if (/^[a-z0-9-]{1,120}$/.test(slug)) {
    const data = (await (await asset(env, '/data/listings.json')).json()) as { listings: { slug: string; name: string }[] };
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
    const data = (await (await asset(env, '/data/land.json')).json()) as { listings: { slug: string; title: string }[] };
    title = data.listings.find((l) => l.slug === slug)?.title ?? '';
  }
  const rw = new HTMLRewriter().on('.cf-turnstile', { element: (e) => { e.setAttribute('data-sitekey', env.TURNSTILE_SITE_KEY ?? ''); } });
  if (!title) return rw.transform(page);
  return rw
    .on('input[name="listing"]', { element: (e) => { e.setAttribute('value', slug); } })
    .on('#update-note', { element: (e) => { e.removeAttribute('hidden'); } })
    .on('#request-type', { element: (e) => { e.removeAttribute('hidden'); } })
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

// Photo ids used by published listings (built into /data/photo-ids.json), cached per isolate for 5 minutes.
let published: { at: number; ids: Set<string> } | undefined;
async function isPublished(env: Env, id: string) {
  if (!published || Date.now() - published.at > 300_000) {
    const r = await asset(env, '/data/photo-ids.json');
    published = { at: Date.now(), ids: new Set(r.ok ? ((await r.json()) as { ids: string[] }).ids : []) };
  }
  return published.ids.has(id);
}

const uploadDeps = (env: Env): UploadDeps | null =>
  env.PHOTOS ? { bucket: env.PHOTOS, secret: env.UPLOAD_SECRET || env.TURNSTILE_SECRET || '', verifyTurnstile: (t, ip) => verifyTurnstile(env.TURNSTILE_SECRET, t, ip) } : null;

/** Email Service binding → the Mailer the alert code expects. */
const mailer = (env: Env): Mailer | undefined =>
  env.ALERTS ? { send: (m) => (env.ALERTS as unknown as { send(m: unknown): Promise<unknown> }).send(m) } : undefined;

const alertDeps = (env: Env): AlertDeps | null =>
  env.DB ? { db: env.DB, mailer: mailer(env), from: env.ALERTS_FROM || 'alerts@rurallandlistings.com', verifyTurnstile: (t, ip) => verifyTurnstile(env.TURNSTILE_SECRET, t, ip) } : null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const method = request.method;
    const read = method === 'GET' || method === 'HEAD';
    const up = uploadDeps(env);
    const deps: FormDeps & { checkUploads?: (token: string, ids: string[]) => Promise<boolean> } = {
      verifyTurnstile: (token, ip) => verifyTurnstile(env.TURNSTILE_SECRET, token, ip),
      send: async (m) => {
        await env.SUBMISSIONS.send(new EmailMessage(m.from, m.to, rawEmail(m, crypto.randomUUID())));
      },
      to: env.SUBMISSIONS_TO,
      from: env.FORM_FROM,
      checkUploads: up
        ? async (token, ids) => {
            const session = await checkSession(up.secret, token);
            return !!session && (await checkFormPhotos(up.bucket, session, ids));
          }
        : undefined,
    };

    if (pathname.startsWith('/photos/') && read) {
      if (!up) return new Response('Not found', { status: 404 });
      return servePhoto(request, up, pathname, (id) => isPublished(env, id));
    }
    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/config' && read) return new Response(JSON.stringify({ turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? '', uploads: !!up, alerts: !!env.DB && !!env.ALERTS }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } });
      if (pathname === '/api/uploads/session' && method === 'POST') return up ? createSession(request, up) : json({ message: 'Photo uploads are not switched on yet.' }, 503);
      const m = /^\/api\/uploads\/([a-f0-9]{16})\/([a-f0-9]{12})\/(\d+)$/.exec(pathname);
      if (m && method === 'PUT') return up ? putPhoto(request, up, m[1], m[2], m[3]) : json({ message: 'Photo uploads are not switched on yet.' }, 503);
      const a = alertDeps(env);
      if (pathname === '/api/saved-searches' && method === 'POST') return a ? createSavedSearch(request, a) : json({ message: 'Email alerts are not switched on yet. Your search is saved on this device.' }, 503);
      if (pathname === '/api/saved-searches/confirm' && read && a) return confirmOrUnsubscribe(request, a, 'confirm');
      if (pathname === '/api/saved-searches/unsubscribe' && read && a) return confirmOrUnsubscribe(request, a, 'unsubscribe');
      if (pathname === '/api/saved-searches/unsubscribe' && method === 'POST' && a) return unsubscribePost(request, a);
      return json({ message: 'Not found' }, 404);
    }

    if (pathname === '/add-your-business/' && method === 'POST') return handleSubmission(request, deps);
    if (pathname === '/sell-your-land/' && method === 'POST') return handleLandSubmission(request, deps);
    if (pathname === '/sell-your-land/' && read) return sellPage(request, env);
    if (pathname === '/sell-your-land/thanks/') return sellThanks(request, env);
    if (pathname === '/add-your-business/' && read) return formPage(request, env);
    if (pathname === '/add-your-business/thanks-verified/') return thanksVerified(request, env);
    return env.ASSETS.fetch(request);
  },

  /** Daily (wrangler.jsonc triggers): email saved searches about listings that went live since the last run. */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const a = alertDeps(env);
    if (!a) return;
    ctx.waitUntil((async () => {
      const r = await asset(env, '/data/search.json');
      if (!r.ok) return;
      const data = (await r.json()) as { items: SearchItem[]; labels: Labels };
      const result = await runAlerts(a, data.items, data.labels);
      console.log('saved-search alerts', JSON.stringify(result));
    })());
  },
} satisfies ExportedHandler<Env>;
