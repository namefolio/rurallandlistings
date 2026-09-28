import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import ListingCard from '../src/components/ListingCard.astro';
import { effectiveTier, enrich, sortListings } from '../src/lib/core';
import { enrichLand, isLive, sortLand } from '../src/lib/land';
import type { ListingData } from '../src/lib/types';

const today = new Date('2026-09-28T09:00:00Z');
const data = (over: Partial<ListingData>): ListingData => ({
  name: 'Test Agent', slug: 'test-agent', status: 'published', tier: 'basic', address: { street: '1 Main St', city: 'Austin', region: 'TX', postalCode: '78701' },
  lat: 30.26, lng: -97.74, sameAs: [], summary: 'A test listing for the tier rules.', attributes: {}, lastUpdated: today, source: 'test',
  ...over,
});

describe('Verified expiry', () => {
  it('keeps Verified through the last paid day and drops to Basic after', () => {
    expect(effectiveTier({ tier: 'verified', verifiedUntil: new Date('2026-09-28') }, today)).toBe('verified');
    expect(effectiveTier({ tier: 'verified', verifiedUntil: new Date('2026-09-27') }, today)).toBe('basic');
  });

  it('renders an expired Verified listing as Basic: no badge, no owner fields, not sorted first', async () => {
    const expired = enrich('texas/austin/test-agent', data({ tier: 'verified', verifiedUntil: new Date('2026-01-01'), description: 'Owner text', bookingUrl: 'https://book.example/' }), today);
    expect(expired.effectiveTier).toBe('basic');
    expect(expired.description).toBeUndefined();
    expect(expired.bookingUrl).toBeUndefined();

    const container = await AstroContainer.create();
    const html = await container.renderToString(ListingCard, { props: { listing: expired } });
    expect(html).not.toContain('Verified');
    expect(html).not.toContain('is-verified');

    const current = enrich('texas/austin/current', data({ name: 'Zed Agent', slug: 'current', tier: 'verified', verifiedUntil: new Date('2027-01-01') }), today);
    expect(await container.renderToString(ListingCard, { props: { listing: current } })).toContain('>Verified<');
    const complete = enrich('texas/austin/aaa', data({ name: 'Aaa Agent', slug: 'aaa', phone: '1' }), today);
    expect(sortListings([expired, complete, current]).map((l) => l.slug)).toEqual(['current', 'aaa', 'test-agent']);
  });
});

describe('Land classified expiry', () => {
  const ad = { status: 'published' as const, postedOn: new Date('2026-08-30'), expiresOn: new Date('2026-09-28') };
  it('is live through its last paid day and gone the day after', () => {
    expect(isLive(ad, today)).toBe(true);
    expect(isLive(ad, new Date('2026-09-29T00:30:00Z'))).toBe(false);
  });
  it('is not live before it starts, or once sold or withdrawn', () => {
    expect(isLive(ad, new Date('2026-08-29'))).toBe(false);
    expect(isLive({ ...ad, status: 'sold' }, today)).toBe(false);
    expect(isLive({ ...ad, status: 'withdrawn' }, today)).toBe(false);
  });
  it('orders ads newest first with no paid placement', () => {
    const mk = (slug: string, posted: string) => enrichLand(`texas/washington-county/${slug}`, { title: slug, slug, status: 'published', location: { county: 'Washington County', region: 'TX' }, lat: 30, lng: -96, acres: 5, seller: { type: 'owner', name: 'X', phone: '555 0100 000' }, summary: 'x'.repeat(40), links: [], attributes: {}, postedOn: new Date(posted), expiresOn: new Date('2026-10-30'), lastUpdated: new Date(posted), source: 'test' });
    expect(sortLand([mk('b-old', '2026-09-01'), mk('a-new', '2026-09-20'), mk('c-new', '2026-09-20')]).map((l) => l.slug)).toEqual(['a-new', 'c-new', 'b-old']);
  });
});
