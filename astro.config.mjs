// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { existsSync, readFileSync } from 'node:fs';

const SITE = 'https://rurallandlistings.com'; // keep in sync with site.config.ts

/** The sitemap runs after pages are written, so leave out any page that marked itself noindex. */
const isIndexable = (/** @type {string} */ page) => {
  const file = `dist${new URL(page).pathname}index.html`;
  return !existsSync(file) || !/<meta name="robots" content="noindex/.test(readFileSync(file, 'utf8'));
};

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [sitemap({ filter: isIndexable })],
  // Never inline scripts: the CSP (public/_headers) allows only same-origin scripts and one hashed snippet.
  vite: { build: { assetsInlineLimit: 0 }, worker: { format: 'es' } },
});
