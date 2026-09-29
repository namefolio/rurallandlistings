import { getCollection, getEntry } from 'astro:content';
import { site } from '../../site.config';
import { enrich, groupRegions, regionName, sortListings, termLabel, type Region } from './core';
import { enrichLand, groupLand, isLive, searchItem, sortLand, type LandRegion } from './land';
import type { Land, LandCategory, Listing } from './types';

/** Demo listings appear in dev and in `npm run build:demo`, never in the production build. */
export const INCLUDE_DEMO = import.meta.env.DEV || import.meta.env.PUBLIC_INCLUDE_DEMO === '1';
export const BUILD_DATE = new Date();

let cache: Promise<{ listings: Listing[]; regions: Region[] }> | undefined;

export function loadAll() {
  return (cache ??= (async () => {
    const entries = await getCollection('listings');
    const seen = new Map<string, string>();
    const listings: Listing[] = [];
    for (const e of entries) {
      if (e.data.status !== 'published') continue;
      if (e.data.demo && !INCLUDE_DEMO) continue;
      const other = seen.get(e.data.slug);
      if (other) throw new Error(`Duplicate listing slug "${e.data.slug}" in ${e.id} and ${other}`);
      seen.set(e.data.slug, e.id);
      listings.push(enrich(e.id, e.data, BUILD_DATE));
    }
    return { listings: sortListings(listings), regions: groupRegions(listings) };
  })());
}

export async function placeIntro(region: string, city?: string): Promise<string | undefined> {
  const entry = await getEntry('places', city ? `${region}/${city}` : region);
  return entry?.body?.trim() || undefined;
}

export interface TermPage { segment: string; term: string; label: string; title: string; description: string; url: string; listings: Listing[] }

/** Category pages exist only with 3+ listings. */
export async function termPages(): Promise<TermPage[]> {
  const { listings } = await loadAll();
  const pages: TermPage[] = [];
  for (const t of site.taxonomies) {
    const counts = new Map<string, Listing[]>();
    for (const l of listings) for (const term of (l.attributes[t.attribute] as string[] | undefined) ?? []) counts.set(term, [...(counts.get(term) ?? []), l]);
    for (const [term, ls] of counts) {
      if (ls.length < 3) continue;
      const label = termLabel(t.attribute, term);
      pages.push({ segment: t.segment, term, label, title: t.title(label), description: t.description(label, ls.length), url: `/${t.segment}/${term}/`, listings: sortListings(ls) });
    }
  }
  return pages;
}

let landCache: Promise<{ land: Land[]; regions: LandRegion[] }> | undefined;

/** Live classifieds only: published, inside their paid period, and not demo in production. */
export function loadLand() {
  return (landCache ??= (async () => {
    const entries = await getCollection('land');
    const seen = new Map<string, string>();
    const land: Land[] = [];
    for (const e of entries) {
      const other = seen.get(e.data.slug);
      if (other) throw new Error(`Duplicate land slug "${e.data.slug}" in ${e.id} and ${other}`);
      seen.set(e.data.slug, e.id);
      if (!isLive(e.data, BUILD_DATE)) continue;
      if (e.data.demo && !INCLUDE_DEMO) continue;
      land.push(enrichLand(e.id, e.data));
    }
    return { land: sortLand(land), regions: groupLand(land) };
  })());
}

export interface LandCategoryPage extends Omit<LandCategory, 'test'> { url: string; listings: Land[] }

/** Land category pages exist only with 3+ live listings. */
export async function landCategoryPages(): Promise<LandCategoryPage[]> {
  const { land } = await loadLand();
  return site.classifieds.categories
    .map(({ test, ...c }) => ({ ...c, url: `/${c.slug}/`, listings: land.filter(test) }))
    .filter((p) => p.listings.length >= 3);
}

// ---- Search and SEO helpers ----

/** Location suggestions for the search box: live states, counties and towns first, then every state. */
export async function searchPlaces(): Promise<string[]> {
  const { land } = await loadLand();
  const live = new Set<string>();
  for (const l of land) {
    live.add(regionName(l.regionSlug));
    live.add(`${l.location.county}, ${l.location.region}`);
    if (l.location.nearestTown) live.add(`${l.location.nearestTown}, ${l.location.region}`);
  }
  const states = Object.values(site.regions).filter((r) => r.code).map((r) => r.name).sort();
  return [...live, ...states.filter((s) => !live.has(s))];
}

export async function searchItems() {
  const { land } = await loadLand();
  return land.map(searchItem);
}

export interface StateTypePage { segment: string; query: string; title: string; noun: string; national: string; region: LandRegion; url: string; listings: Land[] }

/** /hunting-land/{state}/ and friends: only states with at least one live listing of that type. */
export async function stateTypePages(): Promise<StateTypePage[]> {
  const { regions } = await loadLand();
  return site.classifieds.stateTypePages.flatMap(({ test, ...t }) =>
    regions
      .map((region) => ({ ...t, region, url: `/${t.segment}/${region.slug}/`, listings: region.listings.filter(test) }))
      .filter((p) => p.listings.length > 0),
  );
}

/** Photo ids used by anything published; the Worker serves only these (plus signed review links). */
export async function publishedPhotoIds(): Promise<string[]> {
  const { land } = await loadLand();
  const { listings } = await loadAll();
  return [...land.flatMap((l) => l.photos.map((p) => p.id)), ...listings.flatMap((l) => (l.photo ? [l.photo.id] : []))].sort();
}
