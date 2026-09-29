// "Add your business" form handler. Pure: the Worker injects Turnstile and email sending, so tests can too.
import { z } from 'zod';
import { site } from '../site.config';
import { HOURS_RE } from './lib/schema';
import { DAYS, PHOTO_KINDS, type AttributeDef } from './lib/types';

export interface Outgoing { from: string; to: string; replyTo: string; subject: string; text: string }
export interface FormDeps {
  verifyTurnstile: (token: string, ip: string | null) => Promise<boolean>;
  send: (msg: Outgoing) => Promise<void>;
  to: string;
  from: string;
  today?: Date;
  /** Checks the upload session token and that every photo id belongs to it and was uploaded. */
  checkUploads?: (sessionToken: string, ids: string[]) => Promise<boolean>;
}

export const text = (max: number) => z.string().trim().max(max);
export const optText = (max: number) => text(max).transform((v) => v || null);
export const optUrl = z.string().trim().max(300).transform((v, ctx) => {
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString();
  } catch {}
  ctx.addIssue({ code: 'custom', message: 'bad url' });
  return z.NEVER;
});
export const noNewlines = (s: string) => !/[\r\n]/.test(s);

export const formPhoto = z.object({
  id: z.string().regex(/^[a-f0-9]{16}\/[a-f0-9]{12}$/),
  alt: z.string().trim().max(160).default(''),
  kind: z.enum(PHOTO_KINDS).optional().catch(undefined),
  width: z.number().int().min(100).max(10000),
  height: z.number().int().min(100).max(10000),
});
export const photosField = (max = 25) => z.string().max(20000).default('[]').transform((v, ctx) => {
  try {
    const r = z.array(formPhoto).max(max).safeParse(JSON.parse(v || '[]'));
    if (r.success) return r.data;
  } catch {}
  ctx.addIssue({ code: 'custom', message: 'bad photos' });
  return z.NEVER;
});


export const formSchema = z.object({
  tier: z.enum(['basic', 'verified']).default('basic'),
  listing: z.string().trim().max(120).regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/).default(''),
  name: text(120).min(2).refine(noNewlines),
  street: text(200).min(1),
  city: text(80).min(1),
  region: text(40).min(1),
  postalCode: text(12).min(1),
  phone: optText(30),
  website: optUrl,
  sameAs: text(1000).default(''),
  description: optText(1200),
  brokerage: text(120).default('').transform((v) => v || null),
  agentType: z.enum(['agent', 'broker', 'auctioneer', 'consultant', '']).default('').transform((v) => v || null),
  email: z.union([z.literal(''), z.email().max(200)]).default('').transform((v) => v || null),
  licenses: text(1000).default(''),
  countiesServed: text(2000).default(''),
  photos: photosField(1),
  uploadSession: z.string().trim().max(200).default(''),
  submitterName: text(100).min(1).refine(noNewlines),
  submitterEmail: z.email().max(200).refine(noNewlines),
  relationship: z.enum(['owner', 'staff', 'customer']),
  consent: z.literal('yes'),
});

export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/** Reads the niche attribute fields from a form. Unknown or unset values are null. */
export function readAttributes(raw: FormData, defs: AttributeDef[]): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const a of defs) {
    if (a.type === 'multi') {
      const vals = raw.getAll(a.key).map(String).filter((v) => v in a.options);
      attributes[a.key] = vals.length ? [...new Set(vals)] : null;
    } else if (a.type === 'bool') {
      const v = raw.get(a.key);
      attributes[a.key] = v === 'yes' ? true : v === 'no' ? false : null;
    } else {
      const n = Number(raw.get(a.key));
      attributes[a.key] = raw.get(a.key) && Number.isInteger(n) && n >= 0 && n <= (a.max ?? 1e6) ? n : null;
    }
  }
  return attributes;
}

/** "TX 123456" per line → [{state, number}]. Lines without a two-letter state code are dropped. */
export function parseLicenses(v: string) {
  const out = new Map<string, { state: string; number?: string }>();
  for (const line of v.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z]{2})\b[\s:#,-]*(.*)$/.exec(line);
    if (!m) continue;
    const state = m[1].toUpperCase();
    const number = m[2].trim().replace(/[^\w .#/-]/g, '').slice(0, 40);
    out.set(state, number ? { state, number } : { state });
  }
  return [...out.values()].slice(0, 20);
}

/** "Washington County, TX" per line → [{state, county}]. */
export function parseCounties(v: string) {
  const out = new Map<string, { state: string; county: string }>();
  for (const line of v.split(/\r?\n|;/)) {
    const m = /^\s*(.+?)\s*,\s*([A-Za-z]{2})\s*$/.exec(line);
    if (!m) continue;
    const name = m[1].replace(/\s+/g, ' ').trim().slice(0, 60);
    const county = /\b(county|parish|borough)$/i.test(name) ? name : `${name} County`;
    out.set(`${m[2].toUpperCase()}:${county.toLowerCase()}`, { state: m[2].toUpperCase(), county });
  }
  return [...out.values()].slice(0, 60);
}

/** Turns form fields into a listing-shaped object. Unknown values are null; tier is always basic. */
export function toListing(f: z.infer<typeof formSchema>, raw: FormData, today: Date) {
  const hours: Record<string, string | null> = {};
  const odd: string[] = [];
  for (const d of DAYS) {
    const v = String(raw.get(`hours_${d}`) ?? '').trim().toLowerCase().replace(/\s+/g, '').slice(0, 40);
    if (!v) hours[d] = null;
    else if (HOURS_RE.test(v)) hours[d] = v;
    else { hours[d] = null; odd.push(`${d}: ${v}`); }
  }
  const attributes = readAttributes(raw, site.attributes);
  const sameAs = f.sameAs.split(/\s+/).filter((u) => /^https?:\/\/\S+$/.test(u)).slice(0, 10);
  return {
    listing: {
      name: f.name,
      slug: f.listing || slugify(f.name),
      status: 'published',
      tier: 'basic',
      verifiedUntil: null,
      address: { street: f.street, city: f.city, region: f.region, postalCode: f.postalCode },
      lat: null,
      lng: null,
      phone: f.phone,
      website: f.website,
      sameAs,
      hours: Object.values(hours).some(Boolean) ? hours : null,
      summary: null,
      attributes,
      lastUpdated: today.toISOString().slice(0, 10),
      source: 'submission',
      description: null,
      bookingUrl: null,
      brokerage: f.brokerage,
      agentType: f.agentType,
      email: f.email,
      licenses: parseLicenses(f.licenses),
      countiesServed: parseCounties(f.countiesServed),
      photo: f.photos[0] ? { id: f.photos[0].id, alt: f.photos[0].alt.length >= 3 ? f.photos[0].alt : f.name, width: f.photos[0].width, height: f.photos[0].height } : null,
    },
    oddHours: odd,
  };
}

export function buildEmail(f: z.infer<typeof formSchema>, raw: FormData, today: Date, origin = `https://${site.domain}`) {
  const isUpdate = !!f.listing;
  // Only an owner or staff member can ask for Verified; customers' corrections are Basic.
  const tier = f.tier === 'verified' && f.relationship !== 'customer' ? 'verified' : 'basic';
  const { listing, oddHours } = toListing(f, raw, today);
  const subject = `[${site.domain}] ${tier === 'verified' ? 'Verified request' : 'Basic'} · ${isUpdate ? `Update: ${f.listing}` : `New listing: ${f.name}`}`;
  const verb = isUpdate ? 'Update' : 'Add';
  const instruction =
    tier === 'verified'
      ? `${verb} this listing per UPDATING.md as Basic now. Do not upgrade it to Verified until the site owner confirms payment and ownership.`
      : `${verb} this listing per UPDATING.md.`;
  const body = [
    instruction,
    '',
    '```json',
    JSON.stringify(listing, null, 2),
    '```',
    '',
    `Tier requested: ${tier === 'verified' ? 'Verified' : 'Basic'}`,
    '',
    'Submitter (private, never publish):',
    `- Name: ${f.submitterName}`,
    `- Email: ${f.submitterEmail}`,
    `- Relationship: ${f.relationship}`,
    '',
    'Description from the submitter:',
    f.description ?? '(none)',
    ...(f.photos.length ? ['', 'Profile photo, review before publishing (link works for 14 days):', `${origin}/photos/${f.photos[0].id}/1600?s=${encodeURIComponent(f.uploadSession)}`] : []),
    ...(tier === 'verified' ? ['', 'License check: look up each license above with the state commission, then set licenseCheck { checkedOn, states } per UPDATING.md.'] : []),
    ...(oddHours.length ? ['', 'Hours as typed (not understood):', ...oddHours] : []),
  ].join('\n');
  return { subject, text: body, tier };
}

export async function handleSubmission(request: Request, deps: FormDeps): Promise<Response> {
  const origin = new URL(request.url).origin;
  const go = (path: string) => new Response(null, { status: 303, headers: { Location: origin + path } });
  let raw: FormData;
  try {
    raw = await request.formData();
  } catch {
    return go('/add-your-business/error/');
  }
  // Bots fill the hidden field; pretend it worked and send nothing.
  if (String(raw.get('fax_number') ?? '')) return go('/add-your-business/thanks/');

  const token = String(raw.get('cf-turnstile-response') ?? '');
  if (!token || !(await deps.verifyTurnstile(token, request.headers.get('CF-Connecting-IP')))) return go('/add-your-business/error/');

  const fields = Object.fromEntries([...raw.entries()].filter(([, v]) => typeof v === 'string'));
  const parsed = formSchema.safeParse(fields);
  if (!parsed.success) return go('/add-your-business/error/');

  if (parsed.data.photos.length) {
    const ok = !!deps.checkUploads && (await deps.checkUploads(parsed.data.uploadSession, parsed.data.photos.map((p) => p.id)));
    if (!ok) return go('/add-your-business/error/?reason=photos');
  }

  const email = buildEmail(parsed.data, raw, deps.today ?? new Date(), origin);
  try {
    await deps.send({ from: deps.from, to: deps.to, replyTo: parsed.data.submitterEmail, subject: email.subject, text: email.text });
  } catch {
    return go('/add-your-business/error/');
  }
  return email.tier === 'verified'
    ? go(`/add-your-business/thanks-verified/?ref=${encodeURIComponent(parsed.data.name)}`)
    : go('/add-your-business/thanks/');
}

/** RFC 5322 message with a UTF-8 plain-text body. */
export function rawEmail(m: Outgoing, messageId: string, date = new Date()): string {
  const enc = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(s)))}?=`);
  return [
    `From: ${site.name} forms <${m.from}>`,
    `To: <${m.to}>`,
    `Reply-To: <${m.replyTo}>`,
    `Subject: ${enc(m.subject)}`,
    `Date: ${date.toUTCString()}`,
    `Message-ID: <${messageId}@${site.domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    m.text.replace(/\r?\n/g, '\r\n'),
  ].join('\r\n');
}
