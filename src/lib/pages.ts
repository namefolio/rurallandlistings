// Route data shared by each .astro page and its markdown twin.
import { site } from '../../site.config';
import { INDEX_MIN, nearest, type City, type Region } from './core';
import { loadAll, loadLand, placeIntro } from './data';
import { nearestLand, type County, type LandRegion } from './land';
import type { Land, Listing } from './types';

const plural = (n: number) => `${n} ${n === 1 ? site.entity.one : site.entity.many}`;

export function factualIntro(listings: Listing[], place: string): string {
  const counts = site.bestFor.map((b) => [b.label, listings.filter(b.test).length] as const).filter(([, n]) => n > 0);
  const tail = counts.length ? ` ${counts.slice(0, 3).map(([label, n]) => `${label}: ${n}`).join('. ')}.` : '';
  return `${plural(listings.length)} in ${place} ${listings.length === 1 ? 'is' : 'are'} listed here.${tail}`;
}

export async function regionPaths() {
  const { regions } = await loadAll();
  return Promise.all(
    regions.map(async (region) => ({
      params: { hub: site.hub, region: region.slug },
      props: { kind: 'agents' as const, region, intro: (await placeIntro(region.slug)) ?? factualIntro(region.listings, region.name), noindex: region.listings.length < INDEX_MIN },
    })),
  );
}

export async function cityPaths() {
  const { regions } = await loadAll();
  const cities = regions.flatMap((r) => r.cities);
  return Promise.all(
    regions.flatMap((region) =>
      region.cities.map(async (city) => ({
        params: { hub: site.hub, region: region.slug, city: city.citySlug },
        props: {
          kind: 'agents' as const,
          region,
          city,
          intro: [factualIntro(city.listings, `${city.name}, ${region.code}`), await placeIntro(region.slug, city.citySlug)].filter(Boolean).join('\n\n'),
          nearbyCities: nearest(city, cities.filter((c) => c !== city), 6),
          noindex: city.listings.length < INDEX_MIN,
          faqs: site.cityFaqs(`${city.name}, ${region.code}`, city.listings),
        },
      })),
    ),
  );
}

export async function listingPaths() {
  const { listings, regions } = await loadAll();
  return listings.map((listing) => {
    const region = regions.find((r) => r.slug === listing.regionSlug) as Region;
    const city = region.cities.find((c) => c.citySlug === listing.citySlug) as City;
    return {
      params: { hub: site.hub, region: listing.regionSlug, city: listing.citySlug, slug: listing.slug },
      props: { kind: 'agents' as const, listing, region, city, nearby: nearest(listing, listings.filter((l) => l !== listing), 4), faqs: site.listingFaqs(listing) },
    };
  });
}

// ---- Classifieds ----

const c = site.classifieds;
const landPlural = (n: number) => `${n} ${n === 1 ? c.entity.one : c.entity.many}`;

export function landIntro(ls: Land[], place: string): string {
  const acres = ls.reduce((s, l) => s + l.acres, 0);
  const fin = ls.filter((l) => l.attributes.ownerFinancing === true).length;
  return `${landPlural(ls.length)} for sale in ${place}, ${c.acresText(acres)} in all.${fin ? ` Owner financing offered on ${fin}.` : ''} Each ad runs ${c.days} days and shows the date it went up.`;
}

export async function landRegionPaths() {
  const { regions } = await loadLand();
  return Promise.all(
    regions.map(async (region) => ({
      params: { hub: c.hub, region: region.slug },
      props: { kind: 'land' as const, region, intro: [landIntro(region.listings, region.name), await placeIntro(region.slug)].filter(Boolean).join('\n\n'), noindex: region.listings.length < INDEX_MIN },
    })),
  );
}

export async function countyPaths() {
  const { regions } = await loadLand();
  const counties = regions.flatMap((r) => r.counties);
  return Promise.all(
    regions.flatMap((region: LandRegion) =>
      region.counties.map(async (county: County) => ({
        params: { hub: c.hub, region: region.slug, city: county.countySlug },
        props: {
          kind: 'land' as const,
          region,
          county,
          intro: [landIntro(county.listings, `${county.name}, ${region.code}`), await placeIntro(region.slug, county.countySlug)].filter(Boolean).join('\n\n'),
          nearbyCounties: nearestLand(county, counties.filter((k) => k !== county), 6),
          noindex: county.listings.length < INDEX_MIN,
          faqs: c.countyFaqs(`${county.name}, ${region.code}`, county.listings),
        },
      })),
    ),
  );
}

export async function landPaths() {
  const { land, regions } = await loadLand();
  const { listings: agents } = await loadAll();
  return land.map((l) => {
    const region = regions.find((r) => r.slug === l.regionSlug) as LandRegion;
    const county = region.counties.find((k) => k.countySlug === l.countySlug) as County;
    return {
      params: { hub: c.hub, region: l.regionSlug, city: l.countySlug, slug: l.slug },
      props: {
        kind: 'land' as const,
        land: l,
        region,
        county,
        agent: l.seller.agentSlug ? agents.find((a) => a.slug === l.seller.agentSlug) : undefined,
        nearby: nearestLand(l, land.filter((x) => x !== l), 4),
        faqs: c.listingFaqs(l, `${county.name}, ${region.code}`),
      },
    };
  });
}
