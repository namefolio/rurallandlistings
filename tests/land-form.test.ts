import { describe, expect, it, vi } from 'vitest';
import type { Outgoing } from '../src/form';
import { handleLandSubmission } from '../src/land-form';

const today = new Date('2026-09-28T12:00:00Z');

function form(extra: Record<string, string | string[]> = {}) {
  const f = new FormData();
  const base: Record<string, string | string[]> = {
    request: 'new', listing: '', title: '40 wooded acres with creek', region: 'TX', county: 'Washington County', nearestTown: 'Brenham', postalCode: '',
    acres: '40', price: '$320,000', summary: 'Rolling hardwoods with a seasonal creek, a gravel drive and power at the road.', links: 'https://photos.example/album not-a-url',
    sellerType: 'owner', sellerName: 'Pat Seller', sellerPhone: '(979) 555-0199', sellerEmail: '', submitterName: 'Pat', submitterEmail: 'pat@example.com', consent: 'yes',
    'cf-turnstile-response': 'token', fax_number: '', landTypes: ['hunting', 'nonsense'], ownerFinancing: 'yes', well: 'no', annualTaxes: '450',
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) for (const x of [v].flat()) f.append(k, x);
  return new Request('https://rurallandlistings.com/sell-your-land/', { method: 'POST', body: f });
}

function deps(turnstile = true) {
  const sent: Outgoing[] = [];
  return { sent, d: { verifyTurnstile: vi.fn(async () => turnstile), send: vi.fn(async (m: Outgoing) => void sent.push(m)), to: 'inbox@example.com', from: 'forms@rurallandlistings.com', today } };
}
const jsonBlock = (text: string) => JSON.parse(text.split('```json\n')[1].split('\n```')[0]);

describe('land form handler', () => {
  it('emails a new paid listing shaped like a land file and sends the seller to pay', async () => {
    const { d, sent } = deps();
    const res = await handleLandSubmission(form(), d);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('https://rurallandlistings.com/sell-your-land/thanks/?ref=40%20wooded%20acres%20with%20creek');
    expect(sent[0].subject).toBe('[rurallandlistings.com] Land listing · New: 40 wooded acres with creek');
    expect(sent[0].text.split('\n')[0]).toMatch(/^Wait for the site owner to confirm the \$49 payment\. Then add this land listing .* expiresOn 30 days later\.$/);
    const l = jsonBlock(sent[0].text);
    expect(Object.keys(l)).toEqual(['title', 'slug', 'status', 'location', 'lat', 'lng', 'acres', 'price', 'seller', 'summary', 'links', 'attributes', 'postedOn', 'expiresOn', 'lastUpdated', 'source']);
    expect(l).toMatchObject({ slug: '40-wooded-acres-with-creek', acres: 40, price: 320000, postedOn: null, expiresOn: null, source: 'submission', links: ['https://photos.example/album'] });
    expect(l.seller).toEqual({ type: 'owner', name: 'Pat Seller', phone: '(979) 555-0199', email: null, agentSlug: null });
    expect(l.attributes).toMatchObject({ landTypes: ['hunting'], ownerFinancing: true, well: false, annualTaxes: 450, surveyed: null });
    expect(sent[0].text).toContain('Request: New listing ($49)');
    expect(JSON.stringify(l)).not.toContain('pat@example.com');
  });

  it('handles a renewal and a change of an existing listing without the full ad', async () => {
    const empty = { title: '', region: '', county: '', acres: '', price: '', summary: '', sellerName: '', sellerPhone: '' };
    let { d, sent } = deps();
    let res = await handleLandSubmission(form({ ...empty, request: 'renew', listing: 'demo-land-listing-1' }), d);
    expect(res.headers.get('Location')).toMatch(/\/sell-your-land\/thanks\/\?ref=demo-land-listing-1$/);
    expect(sent[0].subject).toBe('[rurallandlistings.com] Land listing · Renewal: demo-land-listing-1');
    expect(sent[0].text).toMatch(/^Wait for the site owner to confirm the \$49 payment\. Then renew/);
    ({ d, sent } = deps());
    res = await handleLandSubmission(form({ ...empty, request: 'change', listing: 'demo-land-listing-1', price: '299000' }), d);
    expect(res.headers.get('Location')).toMatch(/\/sell-your-land\/thanks-change\/$/);
    expect(sent[0].text).toContain('Do not change postedOn or expiresOn.');
    expect(jsonBlock(sent[0].text)).toMatchObject({ slug: 'demo-land-listing-1', price: 299000, title: null });
  });

  it('rejects incomplete, mismatched and invalid submissions', async () => {
    const bads: Record<string, string>[] = [
      { summary: 'too short' }, { acres: '' }, { acres: 'lots' }, { sellerPhone: '' }, { region: 'Texas' }, { consent: '' },
      { request: 'renew' }, { listing: 'demo-land-listing-1' }, { title: 'a\r\nBcc: x@y.z' }, { price: '12.5' },
    ];
    for (const bad of bads) {
      const { d, sent } = deps();
      const res = await handleLandSubmission(form(bad), d);
      expect(res.headers.get('Location'), JSON.stringify(bad)).toMatch(/\/error\/$/);
      expect(sent).toHaveLength(0);
    }
  });

  it('drops honeypot submissions and rejects a bad Turnstile token', async () => {
    let { d, sent } = deps();
    expect((await handleLandSubmission(form({ fax_number: 'x' }), d)).headers.get('Location')).toMatch(/\/thanks\/$/);
    expect(sent).toHaveLength(0);
    ({ d, sent } = deps(false));
    expect((await handleLandSubmission(form(), d)).headers.get('Location')).toMatch(/\/error\/$/);
    expect(sent).toHaveLength(0);
  });
});
