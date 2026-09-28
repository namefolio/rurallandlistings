// Pure listing logic: tiers, ordering, grouping, nearby. No Astro imports so tests can use it directly.
import { site } from '../../site.config';
import type { Day, Listing, ListingData, Tier } from './types';
import { DAYS } from './types';

export const DAY_LABELS: Record<Day, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const SCHEMA_DAYS: Record<Day, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

/** Start of the given day in UTC, so a listing verified "until 2026-10-01" is still Verified on that day. */
const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Verified only while paid and in date; everything else renders as Basic. */
export function effectiveTier(l: Pick<ListingData, 'tier' | 'verifiedUntil'>, today: Date): Tier {
  return l.tier === 'verified' && l.verifiedUntil && day(l.verifiedUntil) >= day(today) ? 'verified' : 'basic';
}

export function completeness(l: ListingData): number {
  let n = 0;
  if (l.phone) n++;
  if (l.website) n++;
  if (l.sameAs.length) n++;
  if (l.hours) n += Object.keys(l.hours).length / 7;
  for (const a of site.attributes) {
    const v = l.attributes[a.key];
    if (v !== undefined && !(Array.isArray(v) && v.length === 0)) n++;
  }
  return n;
}

export const regionName = (slug: string) => site.regions[slug]?.name ?? titleCase(slug);
export const regionCode = (slug: string) => site.regions[slug]?.code ?? regionName(slug);
export const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const regionUrl = (r: string) => `/${site.hub}/${r}/`;
export const cityUrl = (r: string, c: string) => `/${site.hub}/${r}/${c}/`;

/** id is "{region}/{city}/{slug}" (the file path). */
export function enrich(id: string, data: ListingData, today: Date): Listing {
  const [regionSlug, citySlug, fileSlug] = id.split('/');
  if (!regionSlug || !citySlug || !fileSlug) throw new Error(`Listing ${id} must live at {region}/{city}/{slug}.json`);
  if (fileSlug !== data.slug) throw new Error(`Listing ${id}: slug "${data.slug}" must match its file name`);
  const tier = effectiveTier(data, today);
  const base: ListingData =
    tier === 'verified' ? data : { ...data, description: undefined, bookingUrl: undefined };
  return {
    ...base,
    regionSlug,
    citySlug,
    effectiveTier: tier,
    url: `${cityUrl(regionSlug, citySlug)}${data.slug}/`,
    completeness: completeness(data),
  };
}

/** Verified first, then Basic; within each, most complete first, then A–Z. */
export function sortListings(ls: Listing[]): Listing[] {
  return [...ls].sort(
    (a, b) =>
      (a.effectiveTier === 'verified' ? 0 : 1) - (b.effectiveTier === 'verified' ? 0 : 1) ||
      b.completeness - a.completeness ||
      a.name.localeCompare(b.name),
  );
}

export interface City { regionSlug: string; citySlug: string; name: string; url: string; listings: Listing[]; lat: number; lng: number }
export interface Region { slug: string; name: string; code: string; url: string; cities: City[]; listings: Listing[] }

export function groupRegions(all: Listing[]): Region[] {
  const regions = new Map<string, Region>();
  for (const l of all) {
    let r = regions.get(l.regionSlug);
    if (!r) regions.set(l.regionSlug, (r = { slug: l.regionSlug, name: regionName(l.regionSlug), code: regionCode(l.regionSlug), url: regionUrl(l.regionSlug), cities: [], listings: [] }));
    r.listings.push(l);
    let c = r.cities.find((x) => x.citySlug === l.citySlug);
    if (!c) r.cities.push((c = { regionSlug: l.regionSlug, citySlug: l.citySlug, name: l.address.city, url: cityUrl(l.regionSlug, l.citySlug), listings: [], lat: 0, lng: 0 }));
    c.listings.push(l);
  }
  for (const r of regions.values()) {
    r.listings = sortListings(r.listings);
    for (const c of r.cities) {
      c.listings = sortListings(c.listings);
      c.lat = c.listings.reduce((s, l) => s + l.lat, 0) / c.listings.length;
      c.lng = c.listings.reduce((s, l) => s + l.lng, 0) / c.listings.length;
    }
    r.cities.sort((a, b) => b.listings.length - a.listings.length || a.name.localeCompare(b.name));
  }
  return [...regions.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function nearest<T extends { lat: number; lng: number }>(from: { lat: number; lng: number }, items: T[], n: number): T[] {
  return [...items].sort((a, b) => distanceKm(from, a) - distanceKm(from, b)).slice(0, n);
}

/** Pages with fewer than 3 listings are noindex and left out of the sitemap. */
export const INDEX_MIN = 3;

export function termLabel(attribute: string, term: string): string {
  const def = site.attributes.find((a) => a.key === attribute);
  return def?.type === 'multi' ? (def.options[term] ?? term) : term;
}

/** Facts table rows: same labels on every listing, "Not listed" when unknown. */
export function factRows(l: ListingData): [string, string][] {
  return site.attributes.map((a) => {
    const v = l.attributes[a.key];
    if (v === undefined || (Array.isArray(v) && !v.length)) return [a.label, 'Not listed'];
    if (a.type === 'multi') return [a.label, (v as string[]).map((k) => a.options[k] ?? k).join(', ')];
    if (a.type === 'bool') return [a.label, v ? 'Yes' : 'No'];
    return [a.label, a.format ? a.format(v as number) : String(v)];
  });
}

export function hoursRows(l: ListingData): [string, string][] {
  return DAYS.map((d) => {
    const h = l.hours?.[d];
    return [DAY_LABELS[d], !h ? 'Not listed' : h === 'closed' ? 'Closed' : h.split(',').map((r) => r.replace('-', '–')).join(', ')];
  });
}

export function openingHoursSpec(l: ListingData) {
  if (!l.hours) return undefined;
  return DAYS.flatMap((d) => {
    const h = l.hours?.[d];
    if (!h || h === 'closed') return [];
    return h.split(',').map((r) => {
      const [opens, closes] = r.split('-');
      return { '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${SCHEMA_DAYS[d]}`, opens, closes };
    });
  });
}

export const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const mapsUrl = (l: ListingData) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.name}, ${l.address.street}, ${l.address.city}, ${l.address.region} ${l.address.postalCode}`)}`;

export const oneLineAddress = (l: ListingData) => `${l.address.street}, ${l.address.city}, ${l.address.region} ${l.address.postalCode}`;
