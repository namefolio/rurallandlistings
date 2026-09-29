// "Save this search": always saved on this device (localStorage); optional email alerts are sent to the
// Worker (/api/saved-searches), which emails a confirmation link first. No account is involved.
import { describe, parseQuery, type Labels } from '../lib/search';

export interface Saved { id: string; name: string; query: string; created: string; alerts?: boolean }
const KEY = 'rll:saved';

export function loadSaved(): Saved[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Saved[]; } catch { return []; }
}
function store(list: Saved[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50))); return true; } catch { return false; }
}

const dialog = document.getElementById('save-dialog') as HTMLDialogElement | null;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let query = '';
let widget: string | undefined;

function labels(): Labels {
  const el = document.getElementById('search-data');
  if (el) return (JSON.parse(el.textContent!) as { labels: Labels }).labels;
  return { states: {}, types: {}, features: [] };
}

let tsLoad: Promise<string> | undefined;
function loadTurnstile(): Promise<string> {
  return (tsLoad ??= (async () => {
    const cfg = (await (await fetch('/api/config')).json()) as { turnstileSiteKey?: string };
    const key = cfg.turnstileSiteKey ?? '';
    if (!key) return '';
    await new Promise<void>((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => fail(new Error('turnstile'));
      document.head.append(s);
    });
    return key;
  })());
}

async function showAlerts(on: boolean) {
  $('save-email-wrap').hidden = !on;
  $<HTMLInputElement>('save-email').required = on;
  if (!on || widget !== undefined) return;
  try {
    const key = await loadTurnstile();
    if (!key) { msg('Email alerts are not switched on yet. Your search will still be saved on this device.', 'err'); return; }
    widget = window.turnstile!.render($('save-turnstile'), { sitekey: key, theme: 'light' });
  } catch {
    msg('Could not load the email check. Your search will still be saved on this device.', 'err');
  }
}

function msg(text: string, kind: 'ok' | 'err' | '' = '') {
  const m = $('save-msg');
  m.textContent = text;
  m.className = `form-msg ${kind}`;
}

function open(q: string, name?: string) {
  if (!dialog) return;
  query = q;
  const text = name || describe(parseQuery(new URLSearchParams(q)), labels());
  $('save-summary').textContent = text;
  $<HTMLInputElement>('save-name').value = text.slice(0, 80);
  msg('');
  $<HTMLButtonElement>('save-submit').disabled = false;
  dialog.showModal();
}

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-save-search]');
  if (!b) return;
  const p = new URLSearchParams(b.dataset.saveSearch ?? location.search);
  p.delete('view');
  open(p.toString(), b.dataset.saveName);
});

if (dialog) {
  dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
  $<HTMLInputElement>('save-alerts').addEventListener('change', (e) => showAlerts((e.target as HTMLInputElement).checked));
  $<HTMLFormElement>('save-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $<HTMLInputElement>('save-name').value.trim() || 'Saved search';
    const alerts = $<HTMLInputElement>('save-alerts').checked;
    const list = loadSaved().filter((s) => s.query !== query);
    const saved = store([{ id: crypto.randomUUID(), name, query, created: new Date().toISOString(), alerts }, ...list]);
    if (!alerts) {
      msg(saved ? 'Saved on this device.' : 'Your browser blocked saving. Bookmark this page instead.', saved ? 'ok' : 'err');
      return;
    }
    const email = $<HTMLInputElement>('save-email').value.trim();
    const token = widget !== undefined ? window.turnstile?.getResponse(widget) : undefined;
    if (!token) { msg('Please complete the check above, then save again.', 'err'); return; }
    $<HTMLButtonElement>('save-submit').disabled = true;
    msg('Saving…');
    try {
      const r = await fetch('/api/saved-searches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, query, token }) });
      const body = (await r.json().catch(() => ({}))) as { message?: string };
      if (r.ok) msg(body.message ?? `Check ${email} for a link to confirm your alerts.`, 'ok');
      else { msg(body.message ?? 'We could not set up email alerts. Your search is saved on this device.', 'err'); $<HTMLButtonElement>('save-submit').disabled = false; }
    } catch {
      msg('We could not reach the server. Your search is saved on this device.', 'err');
      $<HTMLButtonElement>('save-submit').disabled = false;
    }
    window.turnstile?.reset(widget);
  });
}

// /saved-searches/: list this device's saved searches.
const listEl = document.getElementById('saved-list');
if (listEl) {
  const render = () => {
    const items = loadSaved();
    $('saved-empty').hidden = items.length > 0;
    listEl.replaceChildren(...items.map((s) => {
      const li = document.createElement('li');
      li.className = 'saved-item';
      const a = document.createElement('a');
      a.href = `/land-for-sale/${s.query ? `?${s.query}` : ''}`;
      a.textContent = s.name;
      const meta = document.createElement('span');
      meta.className = 'muted small';
      meta.textContent = `Saved ${new Date(s.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${s.alerts ? ' · email alerts requested' : ''}`;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-ghost btn-sm';
      del.textContent = 'Remove';
      del.setAttribute('aria-label', `Remove saved search: ${s.name}`);
      del.addEventListener('click', () => { store(loadSaved().filter((x) => x.id !== s.id)); render(); });
      const text = document.createElement('div');
      text.append(a, meta);
      li.append(text, del);
      return li;
    }));
  };
  render();
}
