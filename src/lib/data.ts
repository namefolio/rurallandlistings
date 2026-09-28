import { getCollection, getEntry } from 'astro:content';
import { site } from '../../site.config';
import { enrich, groupRegions, sortListings, termLabel, type Region } from './core';
import type { Listing } from './types';

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
