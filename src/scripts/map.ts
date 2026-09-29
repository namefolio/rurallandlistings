// MapLibre maps, loaded only when a map is actually shown (search map view, property map in view).
// Pins are approximate: listings carry a rounded point unless the seller chose to show the exact spot.
import type { Map as MLMap, Marker, Popup } from 'maplibre-gl';
import type { SearchItem } from '../lib/search';

type ML = typeof import('maplibre-gl');
let lib: Promise<ML> | undefined;

function load(): Promise<ML> {
  return (lib ??= (async () => {
    const [ml, worker, css] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
      import('maplibre-gl/dist/maplibre-gl.css?url'),
    ]);
    // Pages inline their own CSS, so the map's stylesheet is emitted as a file and linked on demand.
    await new Promise<void>((ok) => {
      const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: css.default });
      link.onload = link.onerror = () => ok();
      document.head.append(link);
    });
    const m = ((ml as unknown as { default?: ML }).default ?? ml) as ML;
    m.setWorkerUrl(new URL(worker.default, location.href).href);
    return m;
  })());
}

const shortPrice = (p?: number) => {
  if (!p) return null;
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(p >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (p >= 1_000) return `$${Math.round(p / 1_000)}K`;
  return `$${p}`;
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (n: number) => `$${n.toLocaleString('en-US')}`;

function popupHtml(i: SearchItem) {
  const img = i.ph ? `<img src="/photos/${esc(i.ph)}/480" alt="" width="96" height="72" loading="lazy">` : `<div class="no-photo"></div>`;
  const facts = `${i.a.toLocaleString('en-US', { maximumFractionDigits: 2 })} acres${i.p ? ` · ${money(Math.round(i.p / i.a))}/acre` : ''}`;
  return `<a class="map-pop" href="${esc(i.u)}">${img}<div><strong>${i.p ? money(i.p) : 'Price on request'}</strong><span class="t">${esc(i.t)}</span><span>${esc(i.c)}, ${esc(i.sc)}</span><span>${facts}</span></div></a>`;
}

export interface ResultsMap {
  setItems(items: SearchItem[], fit?: boolean): void;
  highlight(url: string | null): void;
  bounds(): { n: number; s: number; e: number; w: number } | null;
  resize(): void;
}

const US_CENTER: [number, number] = [-96.5, 38.5];

export async function resultsMap(el: HTMLElement, style: string, opts: { onSelect?: (url: string) => void; onMove?: () => void }): Promise<ResultsMap> {
  const ml = await load();
  const map: MLMap = new ml.Map({ container: el, style, center: US_CENTER, zoom: 3.2, attributionControl: { compact: true }, cooperativeGestures: false });
  map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
  let markers = new Map<string, Marker>();
  let popup: Popup | null = null;
  let active: string | null = null;
  let moving = false;

  map.on('moveend', () => { if (!moving) opts.onMove?.(); });

  const api: ResultsMap = {
    setItems(items, fit = true) {
      const keep = new Set(items.map((i) => i.u));
      for (const [u, m] of markers) if (!keep.has(u)) { m.remove(); markers.delete(u); }
      for (const i of items) {
        if (markers.has(i.u)) continue;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'map-pin';
        b.textContent = shortPrice(i.p) ?? `${Math.round(i.a)} ac`;
        b.setAttribute('aria-label', `${i.t}, ${i.p ? money(i.p) : 'price on request'}, ${i.c}, ${i.sc}`);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          popup?.remove();
          popup = new ml.Popup({ offset: 20, maxWidth: '300px', focusAfterOpen: false }).setLngLat([i.lng, i.lat]).setHTML(popupHtml(i)).addTo(map);
          api.highlight(i.u);
          opts.onSelect?.(i.u);
        });
        markers.set(i.u, new ml.Marker({ element: b }).setLngLat([i.lng, i.lat]).addTo(map));
      }
      if (fit && items.length) {
        const bb = new ml.LngLatBounds();
        for (const i of items) bb.extend([i.lng, i.lat]);
        moving = true;
        map.fitBounds(bb, { padding: 60, maxZoom: 11, duration: 0 });
        moving = false;
      }
    },
    highlight(url) {
      if (active) markers.get(active)?.getElement().classList.remove('is-active');
      active = url;
      if (url) markers.get(url)?.getElement().classList.add('is-active');
    },
    bounds() {
      const b = map.getBounds();
      return b ? { n: b.getNorth(), s: b.getSouth(), e: b.getEast(), w: b.getWest() } : null;
    },
    resize() { map.resize(); },
  };
  return api;
}

/** A property's approximate area (a ~1.5 km circle) or, if the seller allowed it, its exact point. */
export async function pointMap(el: HTMLElement, style: string, p: { lat: number; lng: number; exact: boolean }) {
  const ml = await load();
  const map = new ml.Map({ container: el, style, center: [p.lng, p.lat], zoom: p.exact ? 13 : 11.5, attributionControl: { compact: true }, cooperativeGestures: true });
  map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
  if (p.exact) {
    new ml.Marker({ color: '#1f5130' }).setLngLat([p.lng, p.lat]).addTo(map);
    return;
  }
  map.on('load', () => {
    const km = 1.5, pts: [number, number][] = [];
    for (let a = 0; a <= 64; a++) {
      const t = (a / 64) * 2 * Math.PI;
      pts.push([p.lng + (km / (111.32 * Math.cos((p.lat * Math.PI) / 180))) * Math.cos(t), p.lat + (km / 110.57) * Math.sin(t)]);
    }
    map.addSource('area', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } } });
    map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#1f5130', 'fill-opacity': 0.15 } });
    map.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': '#1f5130', 'line-width': 2, 'line-dasharray': [2, 1.5] } });
  });
}
