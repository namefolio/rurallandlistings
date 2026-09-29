// Photo uploads to R2. Pure handlers (the Worker injects R2, Turnstile and the signing key) so tests can run them.
//
// 1. The browser passes a Turnstile check once and gets an upload session: "{id}.{exp}.{sig}" (HMAC-signed).
// 2. It resizes each photo itself (480/960/1600 px WebP, or JPEG where the browser can't make WebP) and PUTs
//    each size to /api/uploads/{session id}/{photo id}/{width} with the session token.
// 3. The listing form sends the photo ids with the session token; the handler checks they belong to it.
// 4. /photos/{id}/{width} serves a photo only once a published listing uses it (the build's manifest), or with
//    a valid session token (the seller's own preview and the reviewer's links in the submission email).
import { PHOTO_WIDTHS } from './lib/photos';

export const MAX_PHOTOS = 25;
export const MAX_BYTES = 3_000_000;
export const SESSION_DAYS = 14;
const TYPES = ['image/webp', 'image/jpeg'];
const HEX16 = /^[a-f0-9]{16}$/;
const HEX12 = /^[a-f0-9]{12}$/;

/** The part of an R2 bucket binding these handlers use. */
export interface PhotoBucket {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; httpEtag: string; writeHttpMetadata(headers: Headers): void } | null>;
  head(key: string): Promise<unknown>;
  list(options: { prefix: string; limit?: number }): Promise<{ objects: { key: string }[] }>;
}

export interface UploadDeps {
  bucket: PhotoBucket;
  secret: string;
  verifyTurnstile: (token: string, ip: string | null) => Promise<boolean>;
  now?: () => number;
}

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const randomHex = (bytes: number) => hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer as ArrayBuffer);

async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(`uploads:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg))).slice(0, 32);
}

const safeEqual = (a: string, b: string) => a.length === b.length && [...a].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

export async function signSession(secret: string, id: string, exp: number) {
  return `${id}.${exp}.${await hmac(secret, `${id}.${exp}`)}`;
}

/** Returns the session id if the token is genuine and not expired. */
export async function checkSession(secret: string, token: string | null, now = Date.now()): Promise<string | null> {
  if (!secret || !token) return null;
  const [id, exp, sig] = token.split('.');
  if (!HEX16.test(id ?? '') || !/^\d{10,13}$/.test(exp ?? '') || !sig) return null;
  if (Number(exp) < now) return null;
  return safeEqual(sig, await hmac(secret, `${id}.${exp}`)) ? id : null;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** POST /api/uploads/session  { token } → { session, expires } */
export async function createSession(request: Request, deps: UploadDeps): Promise<Response> {
  if (!deps.secret) return json({ message: 'Photo uploads are not switched on yet.' }, 503);
  let token = '';
  try { token = String(((await request.json()) as { token?: unknown }).token ?? ''); } catch {}
  if (!token || !(await deps.verifyTurnstile(token, request.headers.get('CF-Connecting-IP')))) return json({ message: 'The security check failed. Please try again.' }, 403);
  const exp = (deps.now?.() ?? Date.now()) + SESSION_DAYS * 86_400_000;
  return json({ session: await signSession(deps.secret, randomHex(8), exp), expires: exp, max: MAX_PHOTOS, widths: PHOTO_WIDTHS });
}

/** PUT /api/uploads/{session}/{photo}/{width} with header X-Upload-Session. */
export async function putPhoto(request: Request, deps: UploadDeps, sessionId: string, photoId: string, width: string): Promise<Response> {
  const id = await checkSession(deps.secret, request.headers.get('X-Upload-Session'), deps.now?.());
  if (!id || id !== sessionId) return json({ message: 'Your upload session has expired. Reload the page to continue.' }, 403);
  if (!HEX12.test(photoId) || !PHOTO_WIDTHS.includes(Number(width) as (typeof PHOTO_WIDTHS)[number])) return json({ message: 'Bad photo reference.' }, 400);
  const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim();
  if (!TYPES.includes(type)) return json({ message: 'Photos must be WebP or JPEG.' }, 415);
  const len = Number(request.headers.get('Content-Length') ?? 0);
  if (len > MAX_BYTES) return json({ message: 'That photo is too large.' }, 413);
  const body = await request.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_BYTES) return json({ message: 'That photo is too large.' }, 413);
  if (!looksLikeImage(new Uint8Array(body), type)) return json({ message: 'That file is not a photo.' }, 415);

  // At most MAX_PHOTOS photos per session.
  const listed = await deps.bucket.list({ prefix: `${sessionId}/`, limit: 1000 });
  const photos = new Set(listed.objects.map((o) => o.key.split('/')[1]));
  if (!photos.has(photoId) && photos.size >= MAX_PHOTOS) return json({ message: `You can upload up to ${MAX_PHOTOS} photos.` }, 409);

  await deps.bucket.put(`${sessionId}/${photoId}/${width}`, body, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  return json({ ok: true, id: `${sessionId}/${photoId}` });
}

/** Magic bytes: RIFF....WEBP or FF D8 FF. */
export function looksLikeImage(b: Uint8Array, type: string) {
  if (type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  return b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
}

/** GET /photos/{session}/{photo}/{width}: published photos for everyone, pending ones with a session token. */
export async function servePhoto(request: Request, deps: Pick<UploadDeps, 'bucket' | 'secret' | 'now'>, path: string, isPublished: (id: string) => Promise<boolean>): Promise<Response> {
  const m = /^\/photos\/([a-f0-9]{16})\/([a-f0-9]{12})\/(\d+)$/.exec(path);
  if (!m || !PHOTO_WIDTHS.includes(Number(m[3]) as (typeof PHOTO_WIDTHS)[number])) return new Response('Not found', { status: 404 });
  const id = `${m[1]}/${m[2]}`;
  const published = await isPublished(id);
  if (!published) {
    const s = await checkSession(deps.secret, new URL(request.url).searchParams.get('s'), deps.now?.());
    if (s !== m[1]) return new Response('Not found', { status: 404 });
  }
  const obj = await deps.bucket.get(`${id}/${m[3]}`);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('ETag', obj.httpEtag);
  headers.set('Cache-Control', published ? 'public, max-age=31536000, immutable' : 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (!published) headers.set('X-Robots-Tag', 'noindex');
  return new Response(obj.body, { headers });
}

/** Checks photo ids sent with a listing: all from this session and actually uploaded. */
export async function checkFormPhotos(bucket: PhotoBucket, sessionId: string, ids: string[]): Promise<boolean> {
  for (const id of ids) {
    const [s, p] = id.split('/');
    if (s !== sessionId || !HEX12.test(p ?? '')) return false;
    if (!(await bucket.head(`${id}/960`))) return false;
  }
  return true;
}
