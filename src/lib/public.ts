import { site } from '../../site.config';
import { isoDate } from './core';
import type { Listing } from './types';

/** The public record of a listing: what the page shows, nothing more. */
export const publicListing = (l: Listing) => ({
  name: l.name,
  slug: l.slug,
  url: new URL(l.url, site.url).href,
  region: l.regionSlug,
  city: l.citySlug,
  tier: l.effectiveTier,
  verifiedUntil: l.effectiveTier === 'verified' && l.verifiedUntil ? isoDate(l.verifiedUntil) : null,
  address: l.address,
  lat: l.lat,
  lng: l.lng,
  phone: l.phone ?? null,
  website: l.website ?? null,
  sameAs: l.sameAs,
  hours: l.hours ?? null,
  summary: l.summary,
  description: l.effectiveTier === 'verified' ? (l.description ?? null) : null,
  bookingUrl: l.effectiveTier === 'verified' ? (l.bookingUrl ?? null) : null,
  attributes: l.attributes,
  lastUpdated: isoDate(l.lastUpdated),
  source: l.source,
});

export const json = (data: unknown) => new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
