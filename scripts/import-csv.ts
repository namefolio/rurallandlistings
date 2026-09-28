// Turns a CSV into listing files: npm run import-csv -- path/to/file.csv [--source "Where the data came from"]
// Columns (header row, any order): name, street, city, region (full name or slug, e.g. Texas), regionCode (e.g. TX),
// postalCode, lat, lng, phone, website, sameAs (space or | separated), summary, lastUpdated (YYYY-MM-DD), source,
// hours_mon … hours_sun ("11:00-19:00" or "closed"), and one column per attribute key in site.config.ts
// (multi values separated by |; yes/no for booleans; numbers for numbers).
// Rows that match an existing listing on name + postal code + phone are skipped. Run `npm run check` afterwards:
// the content schema rejects anything invalid.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src/content/listings';
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const CORE = new Set(['name', 'street', 'city', 'region', 'regionCode', 'postalCode', 'lat', 'lng', 'phone', 'website', 'sameAs', 'summary', 'lastUpdated', 'source', ...DAYS.map((d) => `hours_${d}`)]);

const [file, ...rest] = process.argv.slice(2);
if (!file) { console.error('Usage: npm run import-csv -- file.csv [--source "..."]'); process.exit(1); }
const defaultSource = rest[rest.indexOf('--source') + 1] && rest.includes('--source') ? rest[rest.indexOf('--source') + 1] : `CSV import: ${file}`;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const key = (name: string, postal: string, phone: string) => `${slug(name)}|${postal.replace(/\s/g, '').toLowerCase()}|${phone.replace(/\D/g, '')}`;
const walk = (d: string): string[] => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : []);

const existing = new Set<string>();
const slugs = new Set<string>();
for (const f of walk(ROOT).filter((f) => f.endsWith('.json'))) {
  const l = JSON.parse(readFileSync(f, 'utf8'));
  existing.add(key(l.name, l.address?.postalCode ?? '', l.phone ?? ''));
  slugs.add(l.slug);
}

const [header, ...rows] = parseCsv(readFileSync(file, 'utf8'));
const cols = header.map((h) => h.trim());
let added = 0, skipped = 0;
for (const r of rows) {
  const v = Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? '').trim()]));
  if (!v.name || !v.city || !v.region) { console.warn(`skip (missing name/city/region): ${r.join(',')}`); skipped++; continue; }
  const k = key(v.name, v.postalCode ?? '', v.phone ?? '');
  if (existing.has(k)) { console.log(`skip duplicate: ${v.name}`); skipped++; continue; }
  existing.add(k);
  let s = slug(v.name);
  if (slugs.has(s)) s = `${s}-${slug(v.city)}`;
  for (let n = 2; slugs.has(s); n++) s = `${slug(v.name)}-${slug(v.city)}-${n}`;
  slugs.add(s);

  const hours = Object.fromEntries(DAYS.filter((d) => v[`hours_${d}`]).map((d) => [d, v[`hours_${d}`].toLowerCase().replace(/\s+/g, '')]));
  const attributes: Record<string, unknown> = {};
  for (const c of cols.filter((c) => !CORE.has(c) && v[c])) {
    const x = v[c];
    attributes[c] = /^(yes|true)$/i.test(x) ? true : /^(no|false)$/i.test(x) ? false : /^\d+$/.test(x) ? Number(x) : x.split('|').map((t) => slug(t)).filter(Boolean);
  }
  const listing = {
    name: v.name,
    slug: s,
    status: 'published',
    tier: 'basic',
    address: { street: v.street ?? '', city: v.city, region: v.regionCode || v.region, postalCode: v.postalCode ?? '' },
    lat: Number(v.lat),
    lng: Number(v.lng),
    ...(v.phone && { phone: v.phone }),
    ...(v.website && { website: v.website }),
    sameAs: (v.sameAs ?? '').split(/[\s|]+/).filter(Boolean),
    ...(Object.keys(hours).length && { hours }),
    summary: v.summary ?? '',
    attributes,
    lastUpdated: v.lastUpdated || new Date().toISOString().slice(0, 10),
    source: v.source || defaultSource,
  };
  const dir = join(ROOT, slug(v.region), slug(v.city));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${s}.json`), JSON.stringify(listing, null, 2) + '\n');
  added++;
}
console.log(`${added} added, ${skipped} skipped. Now run: npm run check && npm run build`);
