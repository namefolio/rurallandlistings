// Route data shared by each .astro page and its markdown twin.
import { site } from '../../site.config';
import { INDEX_MIN, nearest, type City, type Region } from './core';
import { loadAll, placeIntro } from './data';
import type { Listing } from './types';

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
      props: { region, intro: (await placeIntro(region.slug)) ?? factualIntro(region.listings, region.name), noindex: region.listings.length < INDEX_MIN },
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
      props: { listing, region, city, nearby: nearest(listing, listings.filter((l) => l !== listing), 4), faqs: site.listingFaqs(listing) },
    };
  });
}
