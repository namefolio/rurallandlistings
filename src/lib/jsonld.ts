import { site } from '../../site.config';
import { isoDate, openingHoursSpec } from './core';
import type { Faq, Listing } from './types';

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
  ...(l.sameAs.length && { sameAs: l.sameAs }),
  ...(l.hours && { openingHoursSpecification: openingHoursSpec(l) }),
  dateModified: isoDate(l.lastUpdated),
});

export const homeGraph = () => [
  { '@context': 'https://schema.org', '@type': 'Organization', '@id': abs('/#org'), name: site.name, url: abs('/') },
  { '@context': 'https://schema.org', '@type': 'WebSite', '@id': abs('/#website'), name: site.name, url: abs('/'), inLanguage: site.lang, publisher: { '@id': abs('/#org') } },
];
