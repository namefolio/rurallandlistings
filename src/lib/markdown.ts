// Markdown twins of every page, for agents. Served at {url}index.md.
import { site } from '../../site.config';
import { factRows, fmtDate, hoursRows, isoDate, mapsUrl, oneLineAddress, type City, type Region } from './core';
import { disclosure } from './copy';
import type { Faq, Listing } from './types';

const abs = (p: string) => new URL(p, site.url).href;
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export const mdResponse = (body: string) =>
  new Response(body.trim() + '\n', { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });

export const faqsMd = (faqs: Faq[], heading = 'Questions') =>
  faqs.length ? `\n## ${heading}\n\n${faqs.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}\n` : '';

const tierLabel = (l: Listing) => (l.effectiveTier === 'verified' ? 'Verified' : 'Basic');

export function listingTable(listings: Listing[], withCity = false): string {
  const head = `| Name | Tier | ${withCity ? 'City | ' : ''}Address | Phone | Facts | Last updated |\n|---|---|${withCity ? '---|' : ''}---|---|---|---|`;
  const rows = listings.map(
    (l) =>
      `| [${cell(l.name)}](${abs(l.url)}) | ${tierLabel(l)} | ${withCity ? `${cell(l.address.city)}, ${l.address.region} | ` : ''}${cell(l.address.street)} | ${l.phone ?? ''} | ${cell(site.cardFacts(l).join('; '))} | ${isoDate(l.lastUpdated)} |`,
  );
  return `${disclosure} Plans: ${abs('/listing-plans/')}\n\n${head}\n${rows.join('\n')}`;
}

export function listingMd(l: Listing, faqs: Faq[], nearby: Listing[]): string {
  const facts = [
    ['Tier', tierLabel(l)],
    ...(l.effectiveTier === 'verified' && l.verifiedUntil ? [['Verified until', isoDate(l.verifiedUntil)]] : []),
    ['Address', oneLineAddress(l)],
    ['Phone', l.phone ?? 'Not listed'],
    ['Website', l.website ?? 'Not listed'],
    ...(l.bookingUrl ? [['Booking', l.bookingUrl]] : []),
    ['Coordinates', `${l.lat}, ${l.lng}`],
    ...factRows(l),
    ['Other links', l.sameAs.join(', ') || 'None listed'],
    ['Google Maps', mapsUrl(l)],
    ['Last updated', isoDate(l.lastUpdated)],
    ['Source', l.source],
  ];
  return `# ${l.name}

${site.entity.One} in ${l.address.city}, ${l.address.region}. Canonical URL: ${abs(l.url)}

${l.summary}
${l.effectiveTier === 'verified' && l.description ? `\nFrom the owner: ${l.description}\n` : ''}
## Facts

| Field | Value |
|---|---|
${facts.map(([k, v]) => `| ${k} | ${cell(v)} |`).join('\n')}

## Hours

| Day | Hours |
|---|---|
${hoursRows(l).map(([d, h]) => `| ${d} | ${h} |`).join('\n')}
${faqsMd(faqs)}
## Nearby

${nearby.map((n) => `- [${n.name}](${abs(n.url)}), ${n.address.city}`).join('\n') || 'None yet.'}

Last updated ${fmtDate(l.lastUpdated)}.`;
}

export function cityMd(region: Region, city: City, intro: string, nearbyCities: City[]): string {
  return `# ${site.entity.Many} in ${city.name}, ${region.code}

Canonical URL: ${abs(city.url)}

${intro}

${listingTable(city.listings)}

## Nearby cities

${nearbyCities.map((c) => `- [${c.name}](${abs(c.url)})`).join('\n') || 'None yet.'}`;
}

export function regionMd(region: Region, intro: string): string {
  return `# ${site.entity.Many} in ${region.name}

Canonical URL: ${abs(region.url)}

${intro}

## Cities

${region.cities.map((c) => `- [${c.name}](${abs(c.url)}): ${c.listings.length} ${c.listings.length === 1 ? site.entity.one : site.entity.many}`).join('\n')}

## All listings

${listingTable(region.listings, true)}`;
}

export function regionsIndexMd(regions: Region[]): string {
  return regions.map((r) => `- [${r.name}](${abs(r.url)}): ${r.cities.map((c) => `[${c.name}](${abs(c.url)})`).join(', ')}`).join('\n');
}
