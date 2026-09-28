// Pure classifieds logic: expiry, ordering, grouping. No Astro imports so tests can use it directly.
import { site } from '../../site.config';
import { day, distanceKm, factRows, regionCode, regionName } from './core';
import type { Land, LandData } from './types';

const c = site.classifieds;

/** A classified is live from postedOn through expiresOn (inclusive), while published. */
export function isLive(l: Pick<LandData, 'status' | 'postedOn' | 'expiresOn'>, today: Date): boolean {
  return l.status === 'published' && day(l.postedOn) <= day(today) && day(l.expiresOn) >= day(today);
}

export const landRegionUrl = (r: string) => `/${c.hub}/${r}/`;
export const countyUrl = (r: string, county: string) => `/${c.hub}/${r}/${county}/`;

/** id is "{region}/{county}/{slug}" (the file path). */
export function enrichLand(id: string, data: LandData): Land {
  const [regionSlug, countySlug, fileSlug] = id.split('/');
  if (!regionSlug || !countySlug || !fileSlug) throw new Error(`Land listing ${id} must live at {region}/{county}/{slug}.json`);
  if (fileSlug !== data.slug) throw new Error(`Land listing ${id}: slug "${data.slug}" must match its file name`);
  return { ...data, regionSlug, countySlug, url: `${countyUrl(regionSlug, countySlug)}${data.slug}/` };
}

/** Every ad is paid the same, so there is no paid placement: newest first, then A–Z. */
export function sortLand(ls: Land[]): Land[] {
  return [...ls].sort((a, b) => b.postedOn.getTime() - a.postedOn.getTime() || a.title.localeCompare(b.title));
}

export interface County { regionSlug: string; countySlug: string; name: string; url: string; listings: Land[]; lat: number; lng: number }
export interface LandRegion { slug: string; name: string; code: string; url: string; counties: County[]; listings: Land[] }

export function groupLand(all: Land[]): LandRegion[] {
  const regions = new Map<string, LandRegion>();
  for (const l of all) {
    let r = regions.get(l.regionSlug);
    if (!r) regions.set(l.regionSlug, (r = { slug: l.regionSlug, name: regionName(l.regionSlug), code: regionCode(l.regionSlug), url: landRegionUrl(l.regionSlug), counties: [], listings: [] }));
    r.listings.push(l);
    let k = r.counties.find((x) => x.countySlug === l.countySlug);
    if (!k) r.counties.push((k = { regionSlug: l.regionSlug, countySlug: l.countySlug, name: l.location.county, url: countyUrl(l.regionSlug, l.countySlug), listings: [], lat: 0, lng: 0 }));
    k.listings.push(l);
  }
  for (const r of regions.values()) {
    r.listings = sortLand(r.listings);
    for (const k of r.counties) {
      k.listings = sortLand(k.listings);
      k.lat = k.listings.reduce((s, l) => s + l.lat, 0) / k.listings.length;
      k.lng = k.listings.reduce((s, l) => s + l.lng, 0) / k.listings.length;
    }
    r.counties.sort((a, b) => b.listings.length - a.listings.length || a.name.localeCompare(b.name));
  }
  return [...regions.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const nearestLand = <T extends { lat: number; lng: number }>(from: { lat: number; lng: number }, items: T[], n: number) =>
  [...items].sort((a, b) => distanceKm(from, a) - distanceKm(from, b)).slice(0, n);

export const landFactRows = (l: LandData) => factRows(l, c.attributes);

/** The seller's approximate point on Google Maps (never a boundary). */
export const landMapsUrl = (l: LandData) => `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;

export const landPlace = (l: Pick<Land, 'location'>) => `${l.location.county}, ${l.location.region}`;
