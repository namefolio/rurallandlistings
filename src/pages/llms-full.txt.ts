import type { APIRoute } from 'astro';
import { site } from '../../site.config';
import { factRows, hoursRows, isoDate, oneLineAddress } from '../lib/core';
import { disclosure } from '../lib/copy';
import { loadAll } from '../lib/data';

export const GET: APIRoute = async () => {
  const { regions } = await loadAll();
  const out = [`# ${site.name}: all published listings\n\n${disclosure} Plans: ${site.url}/listing-plans/`];
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
