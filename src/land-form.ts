// "Sell your land" form handler: a paid classified (new, renewal or change). Pure, like src/form.ts:
// the Worker injects Turnstile and email sending, so tests can too.
import { z } from 'zod';
import { PLACEHOLDERS, site } from '../site.config';
import { noNewlines, optText, optUrl, readAttributes, slugify, text, type FormDeps } from './form';
import { PHOTO_KINDS } from './lib/types';

export interface LandFormDeps extends FormDeps {
  /** Checks the upload session token and that every photo id belongs to it and was uploaded. */
  checkUploads?: (sessionToken: string, ids: string[]) => Promise<boolean>;
}

const formPhoto = z.object({
  id: z.string().regex(/^[a-f0-9]{16}\/[a-f0-9]{12}$/),
  alt: z.string().trim().max(160).default(''),
  kind: z.enum(PHOTO_KINDS).optional().catch(undefined),
  width: z.number().int().min(100).max(10000),
  height: z.number().int().min(100).max(10000),
});
const photosField = z.string().max(20000).default('[]').transform((v, ctx) => {
  try {
    const r = z.array(formPhoto).max(25).safeParse(JSON.parse(v || '[]'));
    if (r.success) return r.data;
  } catch {}
  ctx.addIssue({ code: 'custom', message: 'bad photos' });
  return z.NEVER;
});

const c = site.classifieds;
const PAGE = '/sell-your-land/';
const optNumber = (max: number, int = false) =>
  z.string().trim().max(20).transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v.replace(/[$,\s]/g, ''));
    if (Number.isFinite(n) && n > 0 && n <= max && (!int || Number.isInteger(n))) return n;
    ctx.addIssue({ code: 'custom', message: 'bad number' });
    return z.NEVER;
  });

export const landFormSchema = z
  .object({
    request: z.enum(['new', 'renew', 'change']).default('new'),
    listing: z.string().trim().max(120).regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/).default(''),
    title: text(90).refine(noNewlines).default(''),
    region: z.string().trim().regex(/^([A-Z]{2})?$/).default(''),
    county: text(60).refine(noNewlines).default(''),
    nearestTown: optText(60),
    postalCode: optText(10),
    acres: optNumber(1_000_000),
    price: optNumber(1_000_000_000, true),
    summary: text(2000).default(''),
    links: text(1500).default(''),
    photos: photosField,
    uploadSession: z.string().trim().max(200).default(''),
    videoUrl: optUrl.default(''),
    exactLocation: z.enum(['yes', '']).default('').transform((v) => v === 'yes'),
    locationHint: optText(160),
    sellerType: z.enum(['owner', 'agent']).default('owner'),
    sellerName: text(100).refine(noNewlines).default(''),
    sellerPhone: optText(30),
    sellerEmail: z.union([z.literal(''), z.email().max(200)]).default('').transform((v) => v || null),
    submitterName: text(100).min(1).refine(noNewlines),
    submitterEmail: z.email().max(200).refine(noNewlines),
    consent: z.literal('yes'),
  })
  // A new listing needs the whole ad; a renewal or change of an existing one only names the listing.
  .refine((f) => (f.request === 'new' ? !f.listing : !!f.listing), { message: 'request does not match listing' })
  .refine(
    (f) => f.request !== 'new' || (f.title.length >= 5 && !!f.region && f.county.length >= 3 && !!f.acres && f.summary.length >= 40 && f.sellerName.length >= 2 && !!(f.sellerPhone || f.sellerEmail)),
    { message: 'new listings need title, state, county, acres, description, seller name and a phone or email' },
  );

export type LandForm = z.infer<typeof landFormSchema>;

/** Turns form fields into a land-file-shaped object. Unknown values are null; dates are set when it goes live. */
export function toLand(f: LandForm, raw: FormData, today: Date) {
  const photos = f.photos.map((p, i) => ({ id: p.id, alt: p.alt.length >= 3 ? p.alt : `Photo ${i + 1} of ${f.title || 'the land'}`, ...(p.kind && { kind: p.kind }), width: p.width, height: p.height }));
  return {
    title: f.title || null,
    slug: f.listing || slugify(f.title),
    status: 'published',
    location: { county: f.county || null, region: f.region || null, nearestTown: f.nearestTown, postalCode: f.postalCode },
    lat: null,
    lng: null,
    acres: f.acres,
    price: f.price,
    seller: { type: f.sellerType, name: f.sellerName || null, phone: f.sellerPhone, email: f.sellerEmail, agentSlug: null },
    summary: f.summary || null,
    links: f.links.split(/\s+/).filter((u) => optUrl.safeParse(u).success && /^https?:\/\//.test(u)).slice(0, 5),
    photos,
    videoUrl: f.videoUrl && /^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//.test(f.videoUrl) ? f.videoUrl : null,
    exactLocation: f.exactLocation || null,
    attributes: readAttributes(raw, c.attributes),
    postedOn: null,
    expiresOn: null,
    lastUpdated: today.toISOString().slice(0, 10),
    source: 'submission',
  };
}

const price = PLACEHOLDERS.classifiedPrice;
const INSTRUCTIONS = {
  new: `Wait for the site owner to confirm the ${price} payment. Then add this land listing per UPDATING.md, with postedOn the day it goes live and expiresOn ${c.days} days later.`,
  renew: `Wait for the site owner to confirm the ${price} payment. Then renew this land listing per UPDATING.md: extend expiresOn by ${c.days} days and apply any changed fields below.`,
  change: `Apply the changed fields below to this land listing per UPDATING.md. Do not change postedOn or expiresOn.`,
};
const LABELS = { new: `New listing (${price})`, renew: `Renewal (${price})`, change: 'Change only (no charge)' };

export function buildLandEmail(f: LandForm, raw: FormData, today: Date, origin = site.url) {
  const subject = `[${site.domain}] Land listing · ${f.request === 'new' ? `New: ${f.title}` : f.request === 'renew' ? `Renewal: ${f.listing}` : `Change: ${f.listing}`}`;
  const body = [
    INSTRUCTIONS[f.request],
    ...(f.request === 'new' ? [] : ['Null or empty values mean "no change".']),
    '',
    '```json',
    JSON.stringify(toLand(f, raw, today), null, 2),
    '```',
    '',
    `Request: ${LABELS[f.request]}`,
    ...(f.locationHint || f.exactLocation ? ['', `Location from the seller${f.exactLocation ? ' (wants the exact spot shown on the map)' : ''}: ${f.locationHint ?? '(none given)'}`] : []),
    ...(f.photos.length ? ['', `Photos (${f.photos.length}), review before publishing. Links work for 14 days:`, ...f.photos.map((p, i) => `${i + 1}. ${origin}/photos/${p.id}/1600?s=${encodeURIComponent(f.uploadSession)}${p.kind ? ` (${p.kind})` : ''}`)] : []),
    ...(f.videoUrl ? ['', `Video link: ${f.videoUrl}`] : []),
    '',
    'Submitter (private, never publish):',
    `- Name: ${f.submitterName}`,
    `- Email: ${f.submitterEmail}`,
  ].join('\n');
  return { subject, text: body };
}

export async function handleLandSubmission(request: Request, deps: LandFormDeps): Promise<Response> {
  const origin = new URL(request.url).origin;
  const go = (path: string) => new Response(null, { status: 303, headers: { Location: origin + PAGE + path } });
  let raw: FormData;
  try {
    raw = await request.formData();
  } catch {
    return go('error/');
  }
  if (String(raw.get('fax_number') ?? '')) return go('thanks/');

  const token = String(raw.get('cf-turnstile-response') ?? '');
  if (!token || !(await deps.verifyTurnstile(token, request.headers.get('CF-Connecting-IP')))) return go('error/');

  const fields = Object.fromEntries([...raw.entries()].filter(([, v]) => typeof v === 'string'));
  const parsed = landFormSchema.safeParse(fields);
  if (!parsed.success) return go('error/');

  if (parsed.data.photos.length) {
    const ok = !!deps.checkUploads && (await deps.checkUploads(parsed.data.uploadSession, parsed.data.photos.map((p) => p.id)));
    if (!ok) return go('error/?reason=photos');
  }

  const email = buildLandEmail(parsed.data, raw, deps.today ?? new Date(), origin);
  try {
    await deps.send({ from: deps.from, to: deps.to, replyTo: parsed.data.submitterEmail, subject: email.subject, text: email.text });
  } catch {
    return go('error/');
  }
  if (parsed.data.request === 'change') return go('thanks-change/');
  return go(`thanks/?ref=${encodeURIComponent(parsed.data.title || parsed.data.listing)}`);
}
