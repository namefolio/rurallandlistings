// Search rules, photo uploads and saved-search alerts, with an in-memory SQLite standing in for D1.
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { site } from '../site.config';
import { activeFilters, describe as describeQuery, matches, parseQuery, sortItems, toParams, type Labels, type SearchItem } from '../src/lib/search';
import { confirmOrUnsubscribe, createSavedSearch, resetSchemaCache, runAlerts, type Db, type Mail, type Stmt } from '../src/saved-searches';
import { checkFormPhotos, checkSession, looksLikeImage, putPhoto, servePhoto, signSession, type PhotoBucket } from '../src/uploads';

const item = (over: Partial<SearchItem>): SearchItem => ({
  u: '/land-for-sale/texas/washington-county/a/', t: 'A', st: 'texas', sc: 'TX', sn: 'Texas', c: 'Washington County', cs: 'washington-county',
  tw: 'Brenham', z: '77833', a: 40, p: 200000, ty: ['hunting'], at: [], lat: 30.1, lng: -96.4, d: '2026-09-20', ...over,
});
const features = site.classifieds.featureFilters;
const labels: Labels = { states: { texas: 'Texas' }, types: { hunting: 'Hunting Land' }, features };

describe('land search', () => {
  it('parses and round-trips a query, dropping junk', () => {
    const q = parseQuery(new URLSearchParams('state=Texas&minAcres=20&maxPrice=$500,000&f=financing&f=road,nonsense&sort=bogus&type=hunting'));
    expect(q).toMatchObject({ state: 'texas', minAcres: 20, maxPrice: 500000, sort: 'newest', type: 'hunting' });
    expect(toParams(q).toString()).toBe('state=texas&type=hunting&minAcres=20&maxPrice=500000&f=financing&f=road&f=nonsense');
  });

  it('matches location text, acres, price, type and features', () => {
    const i = item({ at: ['ownerFinancing'] });
    const q = (s: string) => parseQuery(new URLSearchParams(s));
    expect(matches(i, q('loc=Washington County, TX'), features)).toBe(true);
    expect(matches(i, q('loc=Brenham'), features)).toBe(true);
    expect(matches(i, q('loc=Travis'), features)).toBe(false);
    expect(matches(i, q('minAcres=50'), features)).toBe(false);
    expect(matches(i, q('maxPrice=150000'), features)).toBe(false);
    expect(matches(item({ p: undefined }), q('maxPrice=150000'), features)).toBe(false);
    expect(matches(item({ p: undefined }), q('minAcres=10'), features)).toBe(true);
    expect(matches(i, q('type=timber'), features)).toBe(false);
    expect(matches(i, q('f=financing'), features)).toBe(true);
    expect(matches(item({}), q('f=financing'), features)).toBe(false);
  });

  it('sorts by price, acreage and price per acre, unpriced last', () => {
    const items = [item({ u: 'a', p: 300000, a: 100 }), item({ u: 'b', p: undefined, a: 5 }), item({ u: 'c', p: 100000, a: 10 })];
    expect(sortItems(items, 'price-asc').map((i) => i.u)).toEqual(['c', 'a', 'b']);
    expect(sortItems(items, 'price-desc').map((i) => i.u)).toEqual(['a', 'c', 'b']);
    expect(sortItems(items, 'acres-desc').map((i) => i.u)).toEqual(['a', 'c', 'b']);
    expect(sortItems(items, 'ppa-asc').map((i) => i.u)).toEqual(['a', 'c', 'b']);
  });

  it('names a search from its filters', () => {
    const q = parseQuery(new URLSearchParams('state=texas&minAcres=20&maxAcres=80&maxPrice=500000'));
    expect(activeFilters(q, labels)).toHaveLength(3);
    expect(describeQuery(q, labels)).toBe('Texas · 20–80 acres · Under $500,000');
    expect(describeQuery(parseQuery(new URLSearchParams('')), labels)).toBe('All land for sale');
  });
});

// ---- uploads ----
function bucket(): PhotoBucket & { data: Map<string, ArrayBuffer> } {
  const data = new Map<string, ArrayBuffer>();
  return {
    data,
    async put(k, v) { data.set(k, v); },
    async get(k) { const v = data.get(k); return v ? { body: new Blob([v]).stream(), httpEtag: '"e"', writeHttpMetadata: (h: Headers) => h.set('Content-Type', 'image/webp') } : null; },
    async head(k) { return data.has(k) ? {} : null; },
    async list({ prefix }) { return { objects: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}
const webp = () => { const b = new Uint8Array(64); b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0); b.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8); return b.buffer; };

describe('photo uploads', () => {
  const secret = 'test-secret';
  const sid = 'a1b2c3d4e5f60718';
  const pid = '0123456789ab';

  it('accepts signed sessions only until they expire', async () => {
    const tok = await signSession(secret, sid, Date.now() + 60_000);
    expect(await checkSession(secret, tok)).toBe(sid);
    expect(await checkSession('other', tok)).toBeNull();
    expect(await checkSession(secret, tok.replace(/.$/, (c) => (c === '0' ? '1' : '0')))).toBeNull();
    expect(await checkSession(secret, await signSession(secret, sid, Date.now() - 1))).toBeNull();
  });

  it('stores real images for the session, and serves them privately until published', async () => {
    const b = bucket();
    const tok = await signSession(secret, sid, Date.now() + 60_000);
    const put = (body: ArrayBuffer, type = 'image/webp', w = '960', t = tok) =>
      putPhoto(new Request(`https://x/api/uploads/${sid}/${pid}/${w}`, { method: 'PUT', body, headers: { 'Content-Type': type, 'X-Upload-Session': t } }), { bucket: b, secret, verifyTurnstile: async () => true }, sid, pid, w);
    expect((await put(new TextEncoder().encode('<script>').buffer as ArrayBuffer)).status).toBe(415);
    expect((await put(webp(), 'image/png')).status).toBe(415);
    expect((await put(webp(), 'image/webp', '777')).status).toBe(400);
    expect((await put(webp(), 'image/webp', '960', 'forged.1.2')).status).toBe(403);
    expect((await put(webp())).status).toBe(200);
    expect(b.data.has(`${sid}/${pid}/960`)).toBe(true);

    const id = `${sid}/${pid}`;
    const deps = { bucket: b, secret };
    expect((await servePhoto(new Request('https://x/'), deps, `/photos/${id}/960`, async () => false)).status).toBe(404);
    const preview = await servePhoto(new Request(`https://x/?s=${tok}`), deps, `/photos/${id}/960`, async () => false);
    expect(preview.status).toBe(200);
    expect(preview.headers.get('Cache-Control')).toBe('private, no-store');
    const live = await servePhoto(new Request('https://x/'), deps, `/photos/${id}/960`, async () => true);
    expect(live.headers.get('Cache-Control')).toContain('immutable');

    expect(await checkFormPhotos(b, sid, [id])).toBe(true);
    expect(await checkFormPhotos(b, sid, [`${sid}/ffffffffffff`])).toBe(false);
    expect(await checkFormPhotos(b, 'ffffffffffffffff', [id])).toBe(false);
  });

  it('recognises JPEG and WebP by their bytes', () => {
    expect(looksLikeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).toBe(true);
    expect(looksLikeImage(new Uint8Array(webp()), 'image/webp')).toBe(true);
    expect(looksLikeImage(new Uint8Array(webp()), 'image/jpeg')).toBe(false);
  });
});

// ---- saved searches ----
function sqlite(): Db {
  const d = new DatabaseSync(':memory:');
  const stmt = (sql: string, args: unknown[] = []): Stmt => ({
    bind: (...v) => stmt(sql, v),
    run: async () => d.prepare(sql).run(...(args as never[])),
    first: async <T>() => (d.prepare(sql).get(...(args as never[])) as T) ?? null,
    all: async <T>() => ({ results: d.prepare(sql).all(...(args as never[])) as T[] }),
  });
  return { prepare: (sql) => stmt(sql) };
}

describe('saved-search alerts', () => {
  it('double opt-in, then one digest per new matching listing, never repeated', async () => {
    resetSchemaCache();
    const db = sqlite();
    const mails: Mail[] = [];
    let now = new Date('2026-09-20T12:00:00Z');
    const deps = { db, from: 'alerts@rurallandlistings.com', mailer: { send: vi.fn(async (m: Mail) => void mails.push(m)) }, verifyTurnstile: async () => true, now: () => now };

    const res = await createSavedSearch(new Request('https://rurallandlistings.com/api/saved-searches', { method: 'POST', body: JSON.stringify({ email: 'Buyer@Example.com', name: 'Texas hunting', query: '?state=texas&type=hunting&view=map', token: 't' }) }), deps);
    expect(res.status).toBe(200);
    expect(mails[0].to).toBe('buyer@example.com');
    const token = /t=([a-f0-9]{32})/.exec(mails[0].text)![1];

    // Unconfirmed searches get nothing.
    const items = [item({ u: '/a/', d: '2026-09-21' }), item({ u: '/b/', d: '2026-09-21', ty: ['farm'] }), item({ u: '/old/', d: '2026-09-01' })];
    now = new Date('2026-09-21T14:00:00Z');
    expect((await runAlerts(deps, items, labels)).sent).toBe(0);

    const c = await confirmOrUnsubscribe(new Request(`https://rurallandlistings.com/api/saved-searches/confirm?t=${token}`), deps, 'confirm');
    expect(c.headers.get('Location')).toBe('https://rurallandlistings.com/saved-searches/confirmed/');

    expect(await runAlerts(deps, items, labels)).toEqual({ checked: 1, sent: 1, failed: 0 });
    const digest = mails.at(-1)!;
    expect(digest.subject).toBe('1 new listing matches “Texas hunting”');
    expect(digest.text).toContain('https://rurallandlistings.com/a/');
    expect(digest.text).not.toContain('/b/');
    expect(digest.text).not.toContain('/old/');
    expect(digest.headers?.['List-Unsubscribe']).toContain(token);

    // Same day again, and the next day: nothing new, nothing sent.
    expect((await runAlerts(deps, items, labels)).sent).toBe(0);
    now = new Date('2026-09-22T14:00:00Z');
    expect((await runAlerts(deps, items, labels)).sent).toBe(0);

    const u = await confirmOrUnsubscribe(new Request(`https://rurallandlistings.com/api/saved-searches/unsubscribe?t=${token}`), deps, 'unsubscribe');
    expect(u.headers.get('Location')).toBe('https://rurallandlistings.com/saved-searches/unsubscribed/');
    expect((await runAlerts(deps, [...items, item({ u: '/c/', d: '2026-09-22' })], labels)).checked).toBe(0);
  });

  it('rejects bad emails and failed security checks, and rolls back when the confirmation cannot be sent', async () => {
    resetSchemaCache();
    const db = sqlite();
    const base = { db, from: 'a@b.co', verifyTurnstile: async () => true };
    const post = (body: object, deps: Parameters<typeof createSavedSearch>[1]) => createSavedSearch(new Request('https://x/api/saved-searches', { method: 'POST', body: JSON.stringify(body) }), deps);
    expect((await post({ email: 'nope', token: 't' }, { ...base, mailer: { send: async () => 0 } })).status).toBe(400);
    expect((await post({ email: 'a@example.com', token: 't' }, { ...base, verifyTurnstile: async () => false, mailer: { send: async () => 0 } })).status).toBe(403);
    expect((await post({ email: 'a@example.com', token: 't' }, { ...base, mailer: { send: async () => { throw new Error('x'); } } })).status).toBe(502);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM saved_searches').first<{ n: number }>()).toEqual({ n: 0 });
  });
});
