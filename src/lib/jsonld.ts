import { site } from '../../site.config';
import { isoDate, openingHoursSpec } from './core';
import { publicPoint } from './land';
import { photoUrl } from './photos';
import type { Faq, Land, Listing } from './types';

const abs = (p: string) => new URL(p, site.url).href;

export const faqPage = (faqs: Faq[]) =>
  faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : [];

export const itemList = (name: string, listings: Listing[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  numberOfItems: listings.length,
  itemListElement: listings.map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(l.url), name: l.name })),
});

/** Business markup. Deliberately says nothing about tier or verification, and carries no ratings. */
export const business = (l: Listing) => ({
  '@context': 'https://schema.org',
  '@type': site.schemaType,
  '@id': abs(l.url) + '#business',
  name: l.name,
  url: l.website ?? abs(l.url),
  mainEntityOfPage: abs(l.url),
  description: l.summary,
  address: { '@type': 'PostalAddress', streetAddress: l.address.street, addressLocality: l.address.city, addressRegion: l.address.region, postalCode: l.address.postalCode, addressCountry: 'US' },
  geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng },
  ...(l.phone && { telephone: l.phone }),
  ...(l.email && { email: l.email }),
  ...(l.photo && { image: abs(photoUrl(l.photo.id, 480)) }),
  ...(l.countiesServed?.length && { areaServed: l.countiesServed.map((c) => ({ '@type': 'AdministrativeArea', name: `${c.county}, ${c.state}` })) }),
  ...(l.sameAs.length && { sameAs: l.sameAs }),
  ...(l.hours && { openingHoursSpecification: openingHoursSpec(l) }),
  dateModified: isoDate(l.lastUpdated),
});

export const homeGraph = () => [
  { '@context': 'https://schema.org', '@type': 'Organization', '@id': abs('/#org'), name: site.name, url: abs('/') },
  { '@context': 'https://schema.org', '@type': 'WebSite', '@id': abs('/#website'), name: site.name, url: abs('/'), inLanguage: site.lang, publisher: { '@id': abs('/#org') } },
];

export const landItemList = (name: string, land: Land[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  numberOfItems: land.length,
  itemListElement: land.map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(l.url), name: l.title })),
});

/** A seller's classified. The place is approximate; no ratings. */
export const landListing = (l: Land) => ({
  '@context': 'https://schema.org',
  '@type': site.classifieds.schemaType,
  '@id': abs(l.url) + '#listing',
  name: l.title,
  url: abs(l.url),
  description: l.summary.slice(0, 500),
  datePosted: isoDate(l.postedOn),
  dateModified: isoDate(l.lastUpdated),
  ...(l.links.length && { sameAs: l.links }),
  about: {
    '@type': 'Place',
    name: `${l.location.county}, ${l.location.region}`,
    address: { '@type': 'PostalAddress', ...(l.location.nearestTown && { addressLocality: l.location.nearestTown }), addressRegion: l.location.region, ...(l.location.postalCode && { postalCode: l.location.postalCode }), addressCountry: 'US' },
    geo: { '@type': 'GeoCoordinates', latitude: publicPoint(l).lat, longitude: publicPoint(l).lng },
  },
  ...(l.photos.length && { image: l.photos.slice(0, 10).map((p) => abs(photoUrl(p.id, 1600))) }),
  offers: {
    '@type': 'Offer',
    ...(l.price && { price: l.price, priceCurrency: site.currency }),
    availability: 'https://schema.org/InStock',
    validThrough: isoDate(l.expiresOn),
    seller: { '@type': l.seller.type === 'owner' ? 'Person' : 'RealEstateAgent', name: l.seller.name },
  },
});
