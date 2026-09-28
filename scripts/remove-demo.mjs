// Deletes every listing file marked "demo": true.
import { readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
let n = 0;
for (const f of files('src/content/listings').filter((f) => f.endsWith('.json'))) {
  if (JSON.parse(readFileSync(f, 'utf8')).demo === true) { rmSync(f); n++; console.log(`removed ${f}`); }
}
console.log(`${n} demo listing(s) removed.`);
