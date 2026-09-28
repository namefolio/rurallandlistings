import type { APIRoute } from 'astro';
import { site } from '../../site.config';
import { factRows, hoursRows, isoDate, oneLineAddress } from '../lib/core';
import { adNotice, disclosure } from '../lib/copy';
import { loadAll, loadLand } from '../lib/data';
import { landFactRows } from '../lib/land';

export const GET: APIRoute = async () => {
  const { regions } = await loadAll();
  const { regions: landRegions } = await loadLand();
  const c = site.classifieds;
  const out = [`# ${site.name}: all published listings\n\n# Land for sale\n\n${adNotice}`];
  for (const r of landRegions) {
    out.push(`\n## Land for sale in ${r.name}`);
    for (const k of r.counties) {
      out.push(`\n### ${k.name}, ${r.code}`);
      for (const l of k.listings) {
        const facts = landFactRows(l).filter(([, v]) => v !== 'Not listed').map(([f, v]) => `- ${f}: ${v}`);
        const contact = [l.seller.phone, l.seller.email].filter(Boolean).join(', ');
        out.push(
          `\n#### ${l.title}\n\n- URL: ${site.url}${l.url}\n- Acres: ${l.acres}\n- Asking price: ${c.priceText(l)}${c.perAcreText(l) ? ` (${c.perAcreText(l)})` : ''}\n- Nearest town: ${l.location.nearestTown ?? 'Not listed'}\n${facts.join('\n')}\n- Seller: ${l.seller.name} (${l.seller.type}), ${contact}\n- From the seller: ${l.summary.replace(/\s+/g, ' ')}\n- Listed: ${isoDate(l.postedOn)}; runs until ${isoDate(l.expiresOn)}`,
        );
      }
    }
  }
  out.push(`\n# ${site.entity.Many}\n\n${disclosure} Plans: ${site.url}/listing-plans/`);
  for (const r of regions) {
    out.push(`\n## ${r.name}`);
    for (const c of r.cities) {
      out.push(`\n### ${c.name}, ${r.code}`);
      for (const l of c.listings) {
        const facts = factRows(l).filter(([, v]) => v !== 'Not listed').map(([k, v]) => `${k}: ${v}`);
        const hours = l.hours ? hoursRows(l).map(([d, h]) => `${d.slice(0, 3)} ${h}`).join('; ') : 'Not listed';
        out.push(
          `\n#### ${l.name}\n\n- Tier: ${l.effectiveTier === 'verified' ? 'Verified' : 'Basic'}\n- URL: ${site.url}${l.url}\n- Address: ${oneLineAddress(l)}\n- Phone: ${l.phone ?? 'Not listed'}\n- Website: ${l.website ?? 'Not listed'}\n- Hours: ${hours}\n${facts.map((f) => `- ${f}`).join('\n')}\n- Summary: ${l.summary}\n- Last updated: ${isoDate(l.lastUpdated)}`,
        );
      }
    }
  }
  return new Response(out.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
