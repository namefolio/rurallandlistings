// "Add your business" form handler. Pure: the Worker injects Turnstile and email sending, so tests can too.
import { z } from 'zod';
import { site } from '../site.config';
import { HOURS_RE } from './lib/schema';
import { DAYS } from './lib/types';

export interface Outgoing { from: string; to: string; replyTo: string; subject: string; text: string }
export interface FormDeps {
  verifyTurnstile: (token: string, ip: string | null) => Promise<boolean>;
  send: (msg: Outgoing) => Promise<void>;
  to: string;
  from: string;
  today?: Date;
}

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => text(max).transform((v) => v || null);
const optUrl = z.string().trim().max(300).transform((v, ctx) => {
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString();
  } catch {}
  ctx.addIssue({ code: 'custom', message: 'bad url' });
  return z.NEVER;
});
const noNewlines = (s: string) => !/[\r\n]/.test(s);

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
  submitterName: text(100).min(1).refine(noNewlines),
  submitterEmail: z.email().max(200).refine(noNewlines),
  relationship: z.enum(['owner', 'staff', 'customer']),
  consent: z.literal('yes'),
});

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

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
  const attributes: Record<string, unknown> = {};
  for (const a of site.attributes) {
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
    },
    oddHours: odd,
  };
}

export function buildEmail(f: z.infer<typeof formSchema>, raw: FormData, today: Date) {
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

  const email = buildEmail(parsed.data, raw, deps.today ?? new Date());
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
