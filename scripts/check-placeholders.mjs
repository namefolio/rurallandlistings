// Warns (does not fail) while launch placeholders remain in site.config.ts or wrangler.jsonc.
import { readFileSync } from 'node:fs';
const left = ['site.config.ts', 'wrangler.jsonc'].filter((f) => /['"]PLACEHOLDER/.test(readFileSync(f, 'utf8')));
if (left.length) console.warn(`Warning: PLACEHOLDER values remain in ${left.join(', ')}. Fill them in before launch.`);
