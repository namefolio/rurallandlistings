import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import ListingCard from '../src/components/ListingCard.astro';
import { effectiveTier, enrich, sortListings } from '../src/lib/core';
import type { ListingData } from '../src/lib/types';

const today = new Date('2026-09-28T09:00:00Z');
const data = (over: Partial<ListingData>): ListingData => ({
  name: 'Test Shop', slug: 'test-shop', status: 'published', tier: 'basic', address: { street: '1 Main St', city: 'Austin', region: 'TX', postalCode: '78701' },
  lat: 30.26, lng: -97.74, sameAs: [], summary: 'A test listing for the tier rules.', attributes: {}, lastUpdated: today, source: 'test',
  ...over,
});

describe('Verified expiry', () => {
  it('keeps Verified through the last paid day and drops to Basic after', () => {
    expect(effectiveTier({ tier: 'verified', verifiedUntil: new Date('2026-09-28') }, today)).toBe('verified');
    expect(effectiveTier({ tier: 'verified', verifiedUntil: new Date('2026-09-27') }, today)).toBe('basic');
  });

  it('renders an expired Verified listing as Basic: no badge, no owner fields, not sorted first', async () => {
    const expired = enrich('texas/austin/test-shop', data({ tier: 'verified', verifiedUntil: new Date('2026-01-01'), description: 'Owner text', bookingUrl: 'https://book.example/' }), today);
    expect(expired.effectiveTier).toBe('basic');
    expect(expired.description).toBeUndefined();
    expect(expired.bookingUrl).toBeUndefined();

    const container = await AstroContainer.create();
    const html = await container.renderToString(ListingCard, { props: { listing: expired } });
    expect(html).not.toContain('Verified');
    expect(html).not.toContain('is-verified');

    const current = enrich('texas/austin/current', data({ name: 'Zed Shop', slug: 'current', tier: 'verified', verifiedUntil: new Date('2027-01-01') }), today);
    expect(await container.renderToString(ListingCard, { props: { listing: current } })).toContain('>Verified<');
    const complete = enrich('texas/austin/aaa', data({ name: 'Aaa Shop', slug: 'aaa', phone: '1' }), today);
    expect(sortListings([expired, complete, current]).map((l) => l.slug)).toEqual(['current', 'aaa', 'test-shop']);
  });
});
