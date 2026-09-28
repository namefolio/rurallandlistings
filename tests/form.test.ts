import { describe, expect, it, vi } from 'vitest';
import { handleSubmission, rawEmail, type Outgoing } from '../src/form';

const today = new Date('2026-09-28T12:00:00Z');

function form(extra: Record<string, string | string[]> = {}) {
  const f = new FormData();
  const base: Record<string, string | string[]> = {
    tier: 'basic', listing: '', name: 'Prairie Land Co', street: '1 Main St', city: 'Brenham', region: 'TX', postalCode: '77833',
    phone: '(512) 555-0100', website: 'https://prairieland.example/', sameAs: 'https://facebook.com/prairieland',
    description: 'Custom work.', submitterName: 'Sam', submitterEmail: 'sam@example.com', relationship: 'owner', consent: 'yes',
    'cf-turnstile-response': 'token', fax_number: '', specialties: ['farms-ranches', 'nonsense'], hours_sun: '12:00-18:00', hours_mon: 'closed', worksWithBuyers: 'yes', accreditedLandConsultant: 'no',
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) for (const x of [v].flat()) f.append(k, x);
  return new Request('https://rurallandlistings.com/add-your-business/', { method: 'POST', body: f });
}

function deps(turnstile = true) {
  const sent: Outgoing[] = [];
  return {
    sent,
    d: { verifyTurnstile: vi.fn(async () => turnstile), send: vi.fn(async (m: Outgoing) => void sent.push(m)), to: 'inbox@example.com', from: 'forms@rurallandlistings.com', today },
  };
}

const jsonBlock = (text: string) => JSON.parse(text.split('```json\n')[1].split('\n```')[0]);

describe('form handler', () => {
  it('emails a valid Basic submission and redirects to thanks', async () => {
    const { d, sent } = deps();
    const res = await handleSubmission(form(), d);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('https://rurallandlistings.com/add-your-business/thanks/');
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('[rurallandlistings.com] Basic · New listing: Prairie Land Co');
    expect(sent[0].text.split('\n')[0]).toBe('Add this listing per UPDATING.md.');
    const l = jsonBlock(sent[0].text);
    expect(l).toMatchObject({ name: 'Prairie Land Co', slug: 'prairie-land-co', status: 'published', tier: 'basic', source: 'submission', lat: null, summary: null, lastUpdated: '2026-09-28' });
    expect(l.attributes.specialties).toEqual(['farms-ranches']);
    expect(l.attributes.worksWithBuyers).toBe(true);
    expect(l.attributes.accreditedLandConsultant).toBe(false);
    expect(l.attributes.worksWithSellers).toBeNull();
    expect(l.hours).toMatchObject({ sun: '12:00-18:00', mon: 'closed', tue: null });
    expect(Object.keys(l)).toEqual(['name', 'slug', 'status', 'tier', 'verifiedUntil', 'address', 'lat', 'lng', 'phone', 'website', 'sameAs', 'hours', 'summary', 'attributes', 'lastUpdated', 'source', 'description', 'bookingUrl']);
    expect(sent[0].text).toContain('Tier requested: Basic');
    expect(sent[0].text).toContain('- Email: sam@example.com');
    expect(JSON.stringify(l)).not.toContain('sam@example.com');
  });

  it('keeps tier basic in the JSON for a Verified request and redirects to the Verified thanks page', async () => {
    const { d, sent } = deps();
    const res = await handleSubmission(form({ tier: 'verified', listing: 'prairie-land-co' }), d);
    expect(res.headers.get('Location')).toBe('https://rurallandlistings.com/add-your-business/thanks-verified/?ref=Prairie%20Land%20Co');
    expect(sent[0].subject).toBe('[rurallandlistings.com] Verified request · Update: prairie-land-co');
    expect(sent[0].text.split('\n')[0]).toMatch(/^Update this listing per UPDATING\.md as Basic now\. Do not upgrade it to Verified until/);
    expect(jsonBlock(sent[0].text)).toMatchObject({ tier: 'basic', slug: 'prairie-land-co', verifiedUntil: null });
    expect(sent[0].text).toContain('Tier requested: Verified');
  });

  it('treats a customer asking for Verified as Basic', async () => {
    const { d, sent } = deps();
    await handleSubmission(form({ tier: 'verified', relationship: 'customer' }), d);
    expect(sent[0].subject).toContain('] Basic · ');
    expect(sent[0].text).toContain('Tier requested: Basic');
  });

  it('drops honeypot submissions silently', async () => {
    const { d, sent } = deps();
    const res = await handleSubmission(form({ fax_number: 'buy now' }), d);
    expect(res.headers.get('Location')).toMatch(/\/thanks\/$/);
    expect(sent).toHaveLength(0);
    expect(d.verifyTurnstile).not.toHaveBeenCalled();
  });

  it('rejects a bad Turnstile token', async () => {
    const { d, sent } = deps(false);
    const res = await handleSubmission(form(), d);
    expect(res.headers.get('Location')).toMatch(/\/error\/$/);
    expect(sent).toHaveLength(0);
  });

  it('rejects a missing Turnstile token without calling the verifier', async () => {
    const { d } = deps();
    const res = await handleSubmission(form({ 'cf-turnstile-response': '' }), d);
    expect(res.headers.get('Location')).toMatch(/\/error\/$/);
    expect(d.verifyTurnstile).not.toHaveBeenCalled();
  });

  it('rejects invalid and over-long fields', async () => {
    const bads: Record<string, string>[] = [{ submitterEmail: 'nope' }, { name: 'x'.repeat(200) }, { consent: '' }, { website: 'javascript:alert(1)' }, { submitterName: 'a\r\nBcc: x@y.z' }];
    for (const bad of bads) {
      const { d, sent } = deps();
      const res = await handleSubmission(form(bad), d);
      expect(res.headers.get('Location'), JSON.stringify(bad)).toMatch(/\/error\/$/);
      expect(sent).toHaveLength(0);
    }
  });

  it('shows the error page when sending fails', async () => {
    const { d } = deps();
    d.send = vi.fn(async () => { throw new Error('down'); });
    const res = await handleSubmission(form(), d);
    expect(res.headers.get('Location')).toMatch(/\/error\/$/);
  });

  it('builds a UTF-8 message with an encoded subject', () => {
    const raw = rawEmail({ from: 'a@b.c', to: 'd@e.f', replyTo: 'g@h.i', subject: '[x] Basic · New listing: Peña Land', text: 'hi\nthere' }, 'id1', today);
    expect(raw).toContain('Subject: =?UTF-8?B?');
    expect(raw).toContain('Reply-To: <g@h.i>');
    expect(raw).toMatch(/\r\n\r\nhi\r\nthere$/);
  });
});
