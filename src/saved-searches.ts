// Saved-search email alerts: sign-up (double opt-in), confirm, unsubscribe, and the daily digest the cron runs.
// Pure: the Worker injects D1, the email binding and Turnstile, so tests can run it with fakes.
import { site } from '../site.config';
import { describe, matches, parseQuery, sortItems, type Labels, type SearchItem } from './lib/search';

/** The parts of a D1 binding used here. */
export interface Stmt {
  bind(...values: unknown[]): Stmt;
  run(): Promise<unknown>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface Db { prepare(sql: string): Stmt; exec?(sql: string): Promise<unknown> }
export interface Mail { to: string; from: { email: string; name: string }; subject: string; text: string; html: string; headers?: Record<string, string> }
export interface Mailer { send(m: Mail): Promise<unknown> }

export interface AlertDeps {
  db: Db;
  mailer?: Mailer;
  from: string;
  verifyTurnstile: (token: string, ip: string | null) => Promise<boolean>;
  now?: () => Date;
}

export const MAX_PER_EMAIL = 10;
export const MAX_ITEMS_PER_EMAIL = 20;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS saved_searches (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, query TEXT NOT NULL, token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, confirmed_at TEXT, last_checked TEXT NOT NULL, last_sent_at TEXT, origin TEXT NOT NULL DEFAULT '${site.url}', sent_urls TEXT NOT NULL DEFAULT '[]')`,
  'CREATE INDEX IF NOT EXISTS saved_searches_email ON saved_searches (email)',
  'CREATE INDEX IF NOT EXISTS saved_searches_confirmed ON saved_searches (confirmed_at)',
];
let ready: Promise<void> | undefined;
const LATER_COLUMNS: [string, string][] = [
  ['origin', `TEXT NOT NULL DEFAULT '${site.url}'`],
  ['sent_urls', "TEXT NOT NULL DEFAULT '[]'"],
];
/** Creates the table (and adds columns an older table lacks) once per isolate. */
export function ensureSchema(db: Db): Promise<void> {
  return (ready ??= (async () => {
    for (const sql of SCHEMA) await db.prepare(sql).run();
    const cols = (await db.prepare('PRAGMA table_info(saved_searches)').all<{ name: string }>()).results.map((c) => c.name);
    for (const [name, def] of LATER_COLUMNS) if (!cols.includes(name)) await db.prepare(`ALTER TABLE saved_searches ADD COLUMN ${name} ${def}`).run();
  })().catch((e) => { ready = undefined; throw e; }));
}
export const resetSchemaCache = () => { ready = undefined; };

const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const day = (d: Date) => d.toISOString().slice(0, 10);
const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-z]{2,}$/i;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function wrapHtml(title: string, body: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;color:#1f2420">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e1dbcf;border-radius:10px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e1dbcf;font-weight:bold;font-size:18px;color:#1f5130">${esc(site.name)}</td></tr>
<tr><td style="padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e1dbcf;font-size:12px;color:#595f57">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

/** POST /api/saved-searches  { email, name, query, token } */
export async function createSavedSearch(request: Request, deps: AlertDeps): Promise<Response> {
  if (!deps.mailer) return json({ message: 'Email alerts are not switched on yet. Your search is saved on this device.' }, 503);
  let b: Record<string, unknown> = {};
  try { b = (await request.json()) as Record<string, unknown>; } catch {}
  const email = String(b.email ?? '').trim().toLowerCase();
  const name = String(b.name ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80) || 'Saved search';
  const query = String(b.query ?? '').replace(/^\?/, '').slice(0, 600);
  if (!EMAIL_RE.test(email) || email.length > 200) return json({ message: 'Please enter a valid email address.' }, 400);
  if (!(await deps.verifyTurnstile(String(b.token ?? ''), request.headers.get('CF-Connecting-IP')))) return json({ message: 'The security check failed. Please try again.' }, 403);
  // Store the query in its normalised form, so the alert matches exactly what the page showed.
  const normalized = new URLSearchParams(query);
  normalized.delete('view');

  await ensureSchema(deps.db);
  const count = await deps.db.prepare('SELECT COUNT(*) AS n FROM saved_searches WHERE email = ?').bind(email).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_PER_EMAIL) return json({ message: `You already have ${MAX_PER_EMAIL} saved searches with email alerts. Unsubscribe from one first.` }, 409);

  const now = deps.now?.() ?? new Date();
  const origin = new URL(request.url).origin;
  const id = hex(8), token = hex(16);
  await deps.db
    .prepare('INSERT INTO saved_searches (id, email, name, query, token, created_at, last_checked, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, email, name, normalized.toString(), token, now.toISOString(), day(now), origin)
    .run();

  const confirm = `${origin}/api/saved-searches/confirm?t=${token}`;
  const unsub = `${origin}/api/saved-searches/unsubscribe?t=${token}`;
  const searchUrl = `${origin}/land-for-sale/${normalized.toString() ? `?${normalized}` : ''}`;
  try {
    await deps.mailer.send({
      to: email,
      from: { email: deps.from, name: site.name },
      subject: `Confirm your land alert: ${name}`,
      text: `Please confirm you want an email when new land matches your saved search "${name}".\n\nConfirm: ${confirm}\n\nSearch: ${searchUrl}\n\nIf you did not ask for this, ignore this email and nothing will be sent. ${site.name} never shares your email address.`,
      html: wrapHtml('Confirm your land alert', `<p>Please confirm you want an email when new land matches your saved search:</p><p style="background:#f7f5f0;padding:10px 12px;border-radius:6px"><strong>${esc(name)}</strong></p><p><a href="${confirm}" style="display:inline-block;background:#1f5130;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Confirm alerts</a></p><p style="font-size:14px"><a href="${esc(searchUrl)}" style="color:#1f5130">See the search</a></p>`, `If you did not ask for this, ignore this email and nothing will be sent. <a href="${unsub}" style="color:#595f57">Remove this search</a>.`),
      headers: { 'List-Unsubscribe': `<${unsub}>` },
    });
  } catch {
    await deps.db.prepare('DELETE FROM saved_searches WHERE id = ?').bind(id).run();
    return json({ message: 'We could not send the confirmation email right now. Your search is saved on this device; please try alerts again later.' }, 502);
  }
  return json({ message: `Almost done: check ${email} and click the link to confirm your alerts.` });
}

/** GET /api/saved-searches/confirm?t= and /unsubscribe?t= → redirect to a static result page. */
export async function confirmOrUnsubscribe(request: Request, deps: Pick<AlertDeps, 'db' | 'now'>, action: 'confirm' | 'unsubscribe'): Promise<Response> {
  const url = new URL(request.url);
  const t = url.searchParams.get('t') ?? '';
  const go = (p: string) => new Response(null, { status: 303, headers: { Location: `${url.origin}/saved-searches/${p}/` } });
  if (!/^[a-f0-9]{32}$/.test(t)) return go('link-expired');
  await ensureSchema(deps.db);
  const row = await deps.db.prepare('SELECT id, confirmed_at FROM saved_searches WHERE token = ?').bind(t).first<{ id: string; confirmed_at: string | null }>();
  if (!row) return go(action === 'unsubscribe' ? 'unsubscribed' : 'link-expired');
  if (action === 'unsubscribe') {
    await deps.db.prepare('DELETE FROM saved_searches WHERE id = ?').bind(row.id).run();
    return go('unsubscribed');
  }
  if (!row.confirmed_at) {
    const now = deps.now?.() ?? new Date();
    await deps.db.prepare('UPDATE saved_searches SET confirmed_at = ?, last_checked = ? WHERE id = ?').bind(now.toISOString(), day(now), row.id).run();
  }
  return go('confirmed');
}

/** One-click unsubscribe (RFC 8058): POST to the List-Unsubscribe URL. */
export async function unsubscribePost(request: Request, deps: Pick<AlertDeps, 'db'>): Promise<Response> {
  const t = new URL(request.url).searchParams.get('t') ?? '';
  if (/^[a-f0-9]{32}$/.test(t)) {
    await ensureSchema(deps.db);
    await deps.db.prepare('DELETE FROM saved_searches WHERE token = ?').bind(t).run();
  }
  return new Response('Unsubscribed', { status: 200 });
}

interface Row { id: string; email: string; name: string; query: string; token: string; last_checked: string; origin: string; sent_urls: string }

/** The daily job: for each confirmed search, email listings that went live after it was last checked. */
export async function runAlerts(deps: AlertDeps, items: SearchItem[], labels: Labels): Promise<{ checked: number; sent: number; failed: number }> {
  await ensureSchema(deps.db);
  const now = deps.now?.() ?? new Date();
  const today = day(now);
  // Purge sign-ups never confirmed within 7 days.
  await deps.db.prepare('DELETE FROM saved_searches WHERE confirmed_at IS NULL AND created_at < ?').bind(new Date(now.getTime() - 7 * 86_400_000).toISOString()).run();
  const { results } = await deps.db.prepare('SELECT id, email, name, query, token, last_checked, origin, sent_urls FROM saved_searches WHERE confirmed_at IS NOT NULL LIMIT 5000').all<Row>();
  let sent = 0, failed = 0;
  for (const r of results) {
    const q = parseQuery(new URLSearchParams(r.query));
    let already: string[] = [];
    try { already = JSON.parse(r.sent_urls || '[]') as string[]; } catch {}
    // Everything that went live since the last check (inclusive, so a listing published later on the day of a run is
    // still caught the next day), minus what this search already emailed.
    const unseen = sortItems(items.filter((i) => i.d >= r.last_checked && i.d <= today && !already.includes(i.u) && matches(i, q, labels.features)), 'newest');
    if (!unseen.length) {
      if (r.last_checked !== today) await deps.db.prepare('UPDATE saved_searches SET last_checked = ? WHERE id = ?').bind(today, r.id).run();
      continue;
    }
    if (!deps.mailer) continue;
    try {
      await deps.mailer.send(digest(r, unseen, labels, deps.from));
      sent++;
      const keep = JSON.stringify([...unseen.map((i) => i.u), ...already].slice(0, 200));
      await deps.db.prepare('UPDATE saved_searches SET last_checked = ?, last_sent_at = ?, sent_urls = ? WHERE id = ?').bind(today, now.toISOString(), keep, r.id).run();
    } catch {
      failed++; // leave the row alone so the next run retries
    }
  }
  return { checked: results.length, sent, failed };
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

export function digest(r: Row, items: SearchItem[], labels: Labels, from: string): Mail {
  const shown = items.slice(0, MAX_ITEMS_PER_EMAIL);
  const q = new URLSearchParams(r.query);
  const searchUrl = `${r.origin}/land-for-sale/${r.query ? `?${q}` : ''}`;
  const unsub = `${r.origin}/api/saved-searches/unsubscribe?t=${r.token}`;
  const line = (i: SearchItem) => `${i.p ? money(i.p) : 'Price on request'} · ${i.a.toLocaleString('en-US', { maximumFractionDigits: 2 })} acres · ${i.c}, ${i.sc}`;
  const n = items.length;
  const subject = `${n} new ${n === 1 ? 'listing matches' : 'listings match'} “${r.name}”`;
  const text = [
    `New land for your saved search "${r.name}" (${describe(parseQuery(q), labels)}):`,
    '',
    ...shown.flatMap((i) => [i.t, line(i), `${r.origin}${i.u}`, '']),
    ...(n > shown.length ? [`And ${n - shown.length} more: ${searchUrl}`, ''] : []),
    `See the search: ${searchUrl}`,
    '',
    'Listings are written by sellers and are not independently verified. Contact sellers directly and do your own due diligence.',
    `Stop these emails: ${unsub}`,
  ].join('\n');
  const html = wrapHtml(
    subject,
    shown
      .map((i) => `<div style="padding:12px 0;border-bottom:1px solid #e1dbcf">${i.ph ? `<a href="${r.origin}${esc(i.u)}"><img src="${r.origin}/photos/${esc(i.ph)}/480" alt="" width="512" style="width:100%;max-width:512px;height:auto;border-radius:6px;display:block;margin-bottom:8px"></a>` : ''}<a href="${r.origin}${esc(i.u)}" style="color:#1f2420;font-weight:bold;font-size:16px;text-decoration:none">${esc(i.t)}</a><div style="color:#1f5130;font-weight:bold;margin-top:4px">${esc(line(i))}</div></div>`)
      .join('') + `<p style="margin-top:16px"><a href="${esc(searchUrl)}" style="display:inline-block;background:#1f5130;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${n > shown.length ? `See all ${n}` : 'See the search'}</a></p>`,
    `You get this because you saved the search “${esc(r.name)}” on ${esc(site.name)}. Listings are written by sellers and are not independently verified. <a href="${unsub}" style="color:#595f57">Unsubscribe</a>.`,
  );
  return { to: r.email, from: { email: from, name: site.name }, subject, text, html, headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
}
