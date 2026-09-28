// Fails if "verified" wording appears anywhere except as the Verified tier name.
// Run after a build (npm run build:demo && npm run check:wording).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
const all = files('dist').filter((f) => /\.(html|md|txt|json|xml)$/.test(f));
if (!all.length) { console.error('No build output. Run npm run build:demo first.'); process.exit(1); }

// Data tokens that are the tier's machine name, not wording.
const DATA = [/"tier":\s*"verified"/g, /verifiedUntil/g, /`verified`/g, /value="verified"/g, /tier=verified/g, /plan-verified/g, /thanks-verified/g, /is-verified/g];
const problems = [];
for (const f of all) {
  let s = readFileSync(f, 'utf8');
  for (const re of DATA) s = s.replace(re, '');
  for (const m of s.matchAll(/\w*verif\w*/gi)) {
    if (m[0] !== 'Verified') problems.push(`${f}: "${m[0]}" …${s.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}…`);
  }
}

// Basic listing pages must never show the badge or the owner-confirmed line.
const listings = JSON.parse(readFileSync('dist/data/listings.json', 'utf8')).listings;
for (const l of listings.filter((x) => x.tier === 'basic')) {
  const html = readFileSync(join('dist', new URL(l.url).pathname, 'index.html'), 'utf8');
  if (/class="badge"|Verified: details confirmed/.test(html)) problems.push(`${l.url}: Basic listing shows Verified label`);
}

// Land ads are never tiered: no badge on any land page.
for (const l of JSON.parse(readFileSync('dist/data/land.json', 'utf8')).listings) {
  const html = readFileSync(join('dist', new URL(l.url).pathname, 'index.html'), 'utf8');
  if (/class="badge"|Verified: details confirmed/.test(html)) problems.push(`${l.url}: land listing shows a Verified label`);
}

if (problems.length) { console.error(`Verified wording check failed:\n${problems.join('\n')}`); process.exit(1); }
console.log(`Verified wording check passed (${all.length} files).`);
