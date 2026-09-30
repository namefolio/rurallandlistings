// /land-for-sale/ in the browser: reads filters from the URL, filters and sorts the server-rendered cards,
// pages them, keeps the URL shareable, and drives the map view. Rules live in src/lib/search.ts.
import { activeFilters, describe, emptyQuery, matches, parseQuery, sortItems, toParams, type FeatureFilter, type Labels, type Query, type SearchItem } from '../lib/search';
import type { ResultsMap } from './map';

interface Data { items: SearchItem[]; labels: Labels; mapStyle: string; pageSize: number }
const data = JSON.parse(document.getElementById('search-data')!.textContent!) as Data;
const features: FeatureFilter[] = data.labels.features;
const form = document.getElementById('filters') as HTMLFormElement;
const list = document.querySelector<HTMLUListElement>('#results .land-grid');
const results = document.getElementById('results');
const cards = new Map<string, HTMLLIElement>();
document.querySelectorAll<HTMLLIElement>('#results li[data-u]').forEach((li) => cards.set(li.dataset.u!, li));
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const countEl = $('count');
const moreWrap = $('more-wrap');
const noResults = $('no-results');
const active = $('active');
const mapWrap = $('map-wrap');
const stateSel = $<HTMLSelectElement>('f-state');
const countySel = $<HTMLSelectElement>('f-county');

let limit = data.pageSize;
let view: 'grid' | 'list' | 'map' = 'grid';
let map: ResultsMap | null = null;
let mapLoading: Promise<void> | null = null;
let current: SearchItem[] = [];
const boundsBox = $<HTMLInputElement>('map-bounds');

function readForm(): Query {
  const fd = new FormData(form);
  const p = new URLSearchParams();
  for (const [k, v] of fd) if (typeof v === 'string' && v.trim()) p.append(k, v);
  return parseQuery(p);
}

function writeForm(q: Query) {
  const set = (name: string, v: string | number | undefined) => {
    const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
    if (el && 'value' in el) el.value = v === undefined ? '' : String(v);
  };
  set('loc', q.loc); set('state', q.state); set('county', q.county); set('town', q.town); set('type', q.type);
  set('minAcres', q.minAcres); set('maxAcres', q.maxAcres); set('minPrice', q.minPrice); set('maxPrice', q.maxPrice);
  $<HTMLSelectElement>('f-sort').value = q.sort;
  form.querySelectorAll<HTMLInputElement>('input[name="f"]').forEach((b) => (b.checked = q.f.includes(b.value)));
}

function syncCounties() {
  const st = stateSel.value;
  for (const o of countySel.options) if (o.value) o.hidden = !!st && o.dataset.state !== st;
  const sel = countySel.selectedOptions[0];
  if (sel?.hidden) countySel.value = '';
}

function inBounds(i: SearchItem) {
  const b = map?.bounds();
  return !b || (i.lat <= b.n && i.lat >= b.s && i.lng <= b.e && i.lng >= b.w);
}

function render(opts: { fit?: boolean } = {}) {
  const q = readForm();
  let found = sortItems(data.items.filter((i) => matches(i, q, features)), q.sort);
  const forMap = found;
  if (view === 'map' && boundsBox.checked && map) found = found.filter(inBounds);
  current = found;

  if (list) {
    for (const li of cards.values()) li.hidden = true;
    found.forEach((i, n) => {
      const li = cards.get(i.u);
      if (!li) return;
      list.appendChild(li);
      li.hidden = n >= limit;
    });
  }
  const n = found.length;
  countEl.textContent = `${n.toLocaleString('en-US')} ${n === 1 ? 'property' : 'properties'} found`;
  document.querySelectorAll<HTMLElement>('[data-show-count]').forEach((b) => (b.textContent = n ? `Show ${n} ${n === 1 ? 'property' : 'properties'}` : 'Show results'));
  if (results) results.hidden = n === 0;
  noResults.hidden = n > 0 || data.items.length === 0;
  moreWrap.hidden = n <= limit;

  const chips = activeFilters(q, data.labels);
  active.replaceChildren(...chips.map(([key, value, label]) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    b.prepend(label);
    b.setAttribute('aria-label', `Remove filter: ${label}`);
    b.addEventListener('click', () => removeFilter(key, value));
    li.append(b);
    return li;
  }));
  const fn = $('filter-n');
  fn.hidden = chips.length === 0;
  fn.textContent = String(chips.length);
  const desc = $('search-desc');
  desc.textContent = chips.length ? describe(q, data.labels) : 'Farms, ranches, timberland, hunting and recreational land from owners and land professionals.';

  const p = toParams(q);
  if (view !== 'grid') p.set('view', view);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  if (map) map.setItems(forMap, opts.fit ?? !boundsBox.checked);
}

function removeFilter(key: keyof Query, value: string) {
  const q = readForm();
  if (key === 'f') q.f = q.f.filter((f) => f !== value);
  else if (key === 'minAcres' || key === 'maxAcres') { q.minAcres = undefined; q.maxAcres = undefined; }
  else if (key === 'minPrice' || key === 'maxPrice') (q as unknown as Record<string, unknown>)[key] = undefined;
  else (q as unknown as Record<string, unknown>)[key] = '';
  writeForm(q);
  syncCounties();
  limit = data.pageSize;
  render({ fit: true });
}

async function ensureMap() {
  if (map || !data.items.length) return;
  mapLoading ??= (async () => {
    const { resultsMap } = await import('./map');
    map = await resultsMap($('map'), data.mapStyle, {
      onSelect: (u) => {
        cards.forEach((li, k) => li.classList.toggle('is-active', k === u));
        const li = cards.get(u);
        if (li && !li.hidden && window.matchMedia('(min-width: 64rem)').matches) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
      onMove: () => { if (boundsBox.checked) render({ fit: false }); },
    });
    $('map-loading').hidden = true;
  })().catch(() => { $('map-loading').textContent = 'The map could not be loaded. The list below still works.'; });
  await mapLoading;
}

function setView(v: typeof view) {
  view = v;
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  results?.classList.toggle('view-list', v === 'list' || v === 'map');
  mapWrap.hidden = v !== 'map' || data.items.length === 0;
  document.body.classList.toggle('map-open', v === 'map');
  const toggle = document.querySelector<HTMLElement>('[data-toggle-map] span');
  if (toggle) toggle.textContent = v === 'map' ? 'List' : 'Map';
  try { localStorage.setItem('rll:view', v === 'map' ? 'grid' : v); } catch {}
  if (v === 'map') ensureMap().then(() => { map?.resize(); render({ fit: true }); });
  else render();
}

// ---- wire up ----
const initial = new URLSearchParams(location.search);
writeForm(parseQuery(initial));
syncCounties();
let startView = (initial.get('view') as typeof view) ?? null;
if (!startView) try { startView = (localStorage.getItem('rll:view') as typeof view) ?? 'grid'; } catch { startView = 'grid'; }
if (!['grid', 'list', 'map'].includes(startView!)) startView = 'grid';

let t: number | undefined;
form.addEventListener('input', (e) => {
  if ((e.target as HTMLElement).id === 'f-state') syncCounties();
  limit = data.pageSize;
  clearTimeout(t);
  t = window.setTimeout(() => render({ fit: true }), (e.target as HTMLInputElement).type === 'checkbox' || (e.target as HTMLElement).tagName === 'SELECT' ? 0 : 250);
});
$<HTMLSelectElement>('f-sort').addEventListener('change', () => render({ fit: false }));
form.addEventListener('submit', (e) => { e.preventDefault(); render({ fit: true }); closeFilters(); });
document.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => {
  writeForm({ ...emptyQuery(), sort: readForm().sort });
  syncCounties();
  limit = data.pageSize;
  render({ fit: true });
}));
$('more').addEventListener('click', () => { limit += data.pageSize; render({ fit: false }); });
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view as typeof view)));
boundsBox.addEventListener('change', () => render({ fit: false }));

// Mobile: filters drawer and map/list toggle.
let lastFocus: HTMLElement | null = null;
function openFilters() {
  lastFocus = document.activeElement as HTMLElement;
  form.classList.add('open');
  document.body.style.overflow = 'hidden';
  form.querySelector<HTMLElement>('input, select')?.focus();
}
function closeFilters() {
  if (!form.classList.contains('open')) return;
  form.classList.remove('open');
  document.body.style.overflow = '';
  lastFocus?.focus();
}
document.querySelectorAll('[data-open-filters]').forEach((b) => b.addEventListener('click', openFilters));
document.querySelectorAll('[data-close-filters]').forEach((b) => b.addEventListener('click', closeFilters));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFilters(); });
document.querySelector('[data-toggle-map]')?.addEventListener('click', () => {
  setView(view === 'map' ? 'grid' : 'map');
  if (view === 'map') mapWrap.scrollIntoView({ block: 'start' });
});

setView(startView as typeof view);
