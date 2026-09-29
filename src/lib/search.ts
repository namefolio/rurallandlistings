// Land search: query parsing, matching, sorting and labels. Pure and dependency-free, so the browser
// (search page), the Worker (saved-search alerts) and the build all share exactly the same rules.

/** One live listing, as the search page and /data/search.json carry it. */
export interface SearchItem {
  /** URL path of the listing page. */
  u: string;
  t: string;
  /** State slug ("texas"), code ("TX") and name. */
  st: string;
  sc: string;
  sn: string;
  /** County display name and slug. */
  c: string;
  cs: string;
  tw?: string;
  z?: string;
  a: number;
  p?: number;
  /** Land type keys. */
  ty: string[];
  /** Attribute keys the seller answered "yes" to. */
  at: string[];
  /** Approximate point (rounded unless the seller chose to show the exact spot). */
  lat: number;
  lng: number;
  /** Date it went live, YYYY-MM-DD. */
  d: string;
  /** Cover photo id, if any. */
  ph?: string;
}

export interface FeatureFilter { key: string; label: string; types?: string[]; attr?: string }

export const SORTS = {
  newest: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'acres-desc': 'Acreage: most first',
  'ppa-asc': 'Price per acre: lowest first',
} as const;
export type Sort = keyof typeof SORTS;

export interface Query {
  loc: string;
  state: string;
  county: string;
  town: string;
  type: string;
  minAcres?: number;
  maxAcres?: number;
  minPrice?: number;
  maxPrice?: number;
  f: string[];
  sort: Sort;
}

export const emptyQuery = (): Query => ({ loc: '', state: '', county: '', town: '', type: '', f: [], sort: 'newest' });

const num = (v: string | null) => {
  if (!v) return undefined;
  const n = Number(v.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const clean = (v: string | null, max = 80) => (v ?? '').trim().slice(0, max);
const slug = (v: string | null) => clean(v).toLowerCase().replace(/[^a-z0-9-]/g, '');

export function parseQuery(params: URLSearchParams): Query {
  const sort = params.get('sort') ?? 'newest';
  return {
    loc: clean(params.get('loc')),
    state: slug(params.get('state')),
    county: slug(params.get('county')),
    town: clean(params.get('town')),
    type: slug(params.get('type')),
    minAcres: num(params.get('minAcres')),
    maxAcres: num(params.get('maxAcres')),
    minPrice: num(params.get('minPrice')),
    maxPrice: num(params.get('maxPrice')),
    f: [...new Set(params.getAll('f').flatMap((v) => v.split(',')).map((v) => slug(v)).filter(Boolean))].slice(0, 20),
    sort: (sort in SORTS ? sort : 'newest') as Sort,
  };
}

/** The query string for a query, leaving out empty values and the default sort. */
export function toParams(q: Query): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: string | number | undefined) => { if (v !== undefined && v !== '') p.set(k, String(v)); };
  set('loc', q.loc); set('state', q.state); set('county', q.county); set('town', q.town); set('type', q.type);
  set('minAcres', q.minAcres); set('maxAcres', q.maxAcres); set('minPrice', q.minPrice); set('maxPrice', q.maxPrice);
  for (const f of q.f) p.append('f', f);
  if (q.sort !== 'newest') p.set('sort', q.sort);
  return p;
}

const norm = (s: string) => s.toLowerCase().replace(/\b(county|parish|borough)\b/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Free-text location: every comma-separated part must match the state, county, town or ZIP. */
export function matchesLocation(item: SearchItem, loc: string): boolean {
  const parts = loc.split(',').map(norm).filter(Boolean);
  if (!parts.length) return true;
  const state = [norm(item.sn), item.sc.toLowerCase()];
  const hay = norm([item.c, item.tw ?? '', item.z ?? '', item.sn].join(' '));
  return parts.every((p) => state.includes(p) || hay.includes(p));
}

export function matches(item: SearchItem, q: Query, features: FeatureFilter[]): boolean {
  if (q.state && item.st !== q.state) return false;
  if (q.county && item.cs !== q.county) return false;
  if (q.town && !norm(item.tw ?? '').includes(norm(q.town))) return false;
  if (q.loc && !matchesLocation(item, q.loc)) return false;
  if (q.type && !item.ty.includes(q.type)) return false;
  if (q.minAcres !== undefined && item.a < q.minAcres) return false;
  if (q.maxAcres !== undefined && item.a > q.maxAcres) return false;
  // Listings without a price stay in unless a price limit is set.
  if (q.minPrice !== undefined && (item.p === undefined || item.p < q.minPrice)) return false;
  if (q.maxPrice !== undefined && (item.p === undefined || item.p > q.maxPrice)) return false;
  for (const key of q.f) {
    const f = features.find((x) => x.key === key);
    if (!f) continue;
    if (f.types && !f.types.some((t) => item.ty.includes(t))) return false;
    if (f.attr && !item.at.includes(f.attr)) return false;
  }
  return true;
}

const ppa = (i: SearchItem) => (i.p ? i.p / i.a : Infinity);

export function sortItems<T extends SearchItem>(items: T[], sort: Sort): T[] {
  const by: Record<Sort, (a: T, b: T) => number> = {
    newest: (a, b) => b.d.localeCompare(a.d),
    'price-asc': (a, b) => (a.p ?? Infinity) - (b.p ?? Infinity),
    'price-desc': (a, b) => (b.p ?? -1) - (a.p ?? -1),
    'acres-desc': (a, b) => b.a - a.a,
    'ppa-asc': (a, b) => ppa(a) - ppa(b),
  };
  return [...items].sort((a, b) => by[sort](a, b) || b.d.localeCompare(a.d) || a.t.localeCompare(b.t));
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

export interface Labels {
  states: Record<string, string>;
  counties?: Record<string, string>;
  types: Record<string, string>;
  features: FeatureFilter[];
}

/** Each active filter as a removable label: [param, value, label]. */
export function activeFilters(q: Query, l: Labels): [keyof Query, string, string][] {
  const out: [keyof Query, string, string][] = [];
  if (q.loc) out.push(['loc', q.loc, q.loc]);
  if (q.state) out.push(['state', q.state, l.states[q.state] ?? q.state]);
  if (q.county) out.push(['county', q.county, l.counties?.[q.county] ?? q.county]);
  if (q.town) out.push(['town', q.town, `Near ${q.town}`]);
  if (q.type) out.push(['type', q.type, l.types[q.type] ?? q.type]);
  if (q.minAcres !== undefined && q.maxAcres !== undefined) out.push(['minAcres', '', `${q.minAcres.toLocaleString('en-US')}–${q.maxAcres.toLocaleString('en-US')} acres`]);
  else if (q.minAcres !== undefined) out.push(['minAcres', '', `${q.minAcres.toLocaleString('en-US')}+ acres`]);
  else if (q.maxAcres !== undefined) out.push(['maxAcres', '', `Up to ${q.maxAcres.toLocaleString('en-US')} acres`]);
  if (q.minPrice !== undefined) out.push(['minPrice', '', `From ${money(q.minPrice)}`]);
  if (q.maxPrice !== undefined) out.push(['maxPrice', '', `Under ${money(q.maxPrice)}`]);
  for (const k of q.f) out.push(['f', k, l.features.find((f) => f.key === k)?.label ?? k]);
  return out;
}

/** A short name for a saved search: "Texas · 20+ acres · Under $500,000 · Hunting". */
export function describe(q: Query, l: Labels): string {
  const parts = activeFilters(q, l).map(([, , label]) => label);
  return parts.length ? parts.join(' · ') : 'All land for sale';
}

export const hasFilters = (q: Query) => activeFilters(q, { states: {}, types: {}, features: [] }).length > 0;
