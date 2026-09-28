// Runs Lighthouse (mobile) on home, an agent city and listing page, a land county and listing page, and both forms. Fails below 100.
// Usage: npm run build:demo && npm run lighthouse   (CHROME_PATH overrides the browser)
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const DIST = 'dist';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml' };

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(DIST, path);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' }); return res.end(); }
    file = join(file, 'index.html');
  }
  if (!existsSync(file)) { res.writeHead(404, { 'Content-Type': TYPES['.html'] }); return res.end(readFileSync(join(DIST, '404.html'))); }
  const long = path.startsWith('/_astro/') || path.startsWith('/fonts/');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': long ? 'public, max-age=31536000, immutable' : 'no-cache' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const data = JSON.parse(readFileSync(join(DIST, 'data/listings.json'), 'utf8'));
const first = data.listings[0];
if (!first) { console.error('No listings in the build. Run npm run build:demo first.'); process.exit(1); }
const listingPath = new URL(first.url).pathname;
const cityPath = listingPath.split('/').slice(0, -2).join('/') + '/';
const pages = { home: '/', city: cityPath, listing: listingPath, form: '/add-your-business/', sell: '/sell-your-land/' };
const land = JSON.parse(readFileSync(join(DIST, 'data/land.json'), 'utf8')).listings[0];
if (land) {
  pages.land = new URL(land.url).pathname;
  pages.county = pages.land.split('/').slice(0, -2).join('/') + '/';
} else console.log('No live land listings in the build; skipping land pages.');
// The forms load Turnstile from Cloudflare, so only their Accessibility, Best Practices and SEO must be 100.
const SKIP = { form: ['Performance'], sell: ['Performance'] };

const chromePath = process.env.CHROME_PATH ?? ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);
const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
mkdirSync('lighthouse-reports', { recursive: true });
let failed = false;
try {
  for (const [name, path] of Object.entries(pages)) {
    const { lhr, report } = await lighthouse(base + path, { port: chrome.port, output: 'html', logLevel: 'error' }, { extends: 'lighthouse:default', settings: { formFactor: 'mobile' } });
    writeFileSync(`lighthouse-reports/${name}.html`, report);
    const scores = Object.values(lhr.categories).map((c) => [c.title, Math.round(c.score * 100)]);
    console.log(`${name.padEnd(8)} ${path}\n  ${scores.map(([t, s]) => `${t}: ${s}`).join(' · ')}`);
    for (const [t, s] of scores) if (s < 100 && !(SKIP[name] ?? []).includes(t)) {
      failed = true;
      const cat = Object.values(lhr.categories).find((c) => c.title === t);
      for (const ref of cat.auditRefs) {
        const a = lhr.audits[ref.id];
        if (ref.weight > 0 && a.score !== null && a.score < 1) console.log(`    ✗ ${t}: ${a.title} (${a.displayValue ?? a.score})`);
      }
    }
  }
} finally {
  await chrome.kill();
  server.close();
}
if (failed) { console.error('Lighthouse: a category is below 100.'); process.exit(1); }
console.log('Lighthouse: all categories 100.');
