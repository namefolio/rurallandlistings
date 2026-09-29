import { site } from '../../site.config';
import { isoDate } from './core';
import { publicPoint } from './land';
import { PHOTO_WIDTHS, photoUrl } from './photos';
import type { Land, Listing, Photo } from './types';

const abs = (p: string) => new URL(p, site.url).href;
const publicPhoto = (p: Photo) => ({ alt: p.alt, kind: p.kind ?? null, width: p.width, height: p.height, urls: Object.fromEntries(PHOTO_WIDTHS.map((w) => [w, abs(photoUrl(p.id, w))])) });

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
  brokerage: l.brokerage ?? null,
  agentType: l.agentType ?? null,
  email: l.email ?? null,
  photo: l.photo ? publicPhoto(l.photo) : null,
  licenses: l.licenses ?? [],
  countiesServed: l.countiesServed ?? [],
  licenseCheck: l.effectiveTier === 'verified' && l.licenseCheck ? { checkedOn: isoDate(l.licenseCheck.checkedOn), states: l.licenseCheck.states } : null,
  lastUpdated: isoDate(l.lastUpdated),
  source: l.source,
});

export const json = (data: unknown) => new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/** The public record of a land classified: what the page shows, nothing more. */
export const publicLand = (l: Land) => ({
  title: l.title,
  slug: l.slug,
  url: new URL(l.url, site.url).href,
  region: l.regionSlug,
  county: l.countySlug,
  location: l.location,
  ...publicPoint(l),
  exactLocation: l.exactLocation === true,
  acres: l.acres,
  price: l.price ?? null,
  seller: { type: l.seller.type, name: l.seller.name, phone: l.seller.phone ?? null, email: l.seller.email ?? null, agentSlug: l.seller.agentSlug ?? null },
  summary: l.summary,
  links: l.links,
  photos: l.photos.map(publicPhoto),
  videoUrl: l.videoUrl ?? null,
  attributes: l.attributes,
  postedOn: isoDate(l.postedOn),
  expiresOn: isoDate(l.expiresOn),
  lastUpdated: isoDate(l.lastUpdated),
  source: l.source,
});
