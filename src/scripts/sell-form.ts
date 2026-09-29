// Sell form: five steps with a progress bar, per-step checks, progress saved on this device, and photo uploads.
import { Uploader, type UploaderState } from './uploader';

const KEY = 'rll:sell-draft';
const form = document.getElementById('sell-form') as HTMLFormElement;
const steps = [...form.querySelectorAll<HTMLElement>('[data-step]')];
const dots = [...form.querySelectorAll<HTMLElement>('[data-step-dot]')];
const back = form.querySelector<HTMLButtonElement>('[data-back]')!;
const next = form.querySelector<HTMLButtonElement>('[data-next]')!;
const note = document.getElementById('saved-note')!;
const isUpdate = () => !!(form.elements.namedItem('listing') as HTMLInputElement).value;
const SKIP = new Set(['listing', 'photos', 'uploadSession', 'cf-turnstile-response', 'fax_number', 'consent', 'request']);
let current = 0;

interface Draft { v: 1; step: number; fields: [string, string][]; uploads?: UploaderState; saved: string }
const readDraft = (): Draft | null => { try { const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Draft | null; return d?.v === 1 ? d : null; } catch { return null; } };

// ---- photos ----
const photosInput = form.elements.namedItem('photos') as HTMLInputElement;
const sessionInput = form.elements.namedItem('uploadSession') as HTMLInputElement;
const draft = isUpdate() ? null : readDraft();
const uploader = new Uploader(form.querySelector('[data-uploader]')!, {
  title: () => (form.elements.namedItem('title') as HTMLInputElement).value,
  restore: draft?.uploads,
  onChange: (s) => {
    photosInput.value = JSON.stringify(s.photos);
    sessionInput.value = s.session;
    save();
  },
});

// ---- restore ----
if (draft) {
  for (const [name, value] of draft.fields) {
    const els = form.querySelectorAll<HTMLInputElement>(`[name="${CSS.escape(name)}"]`);
    els.forEach((el) => {
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = draft.fields.some(([n, v]) => n === name && v === el.value);
      else if (el.value === '' || el.tagName === 'SELECT') el.value = value;
    });
  }
  current = Math.min(draft.step, steps.length - 1);
  note.textContent = 'We restored your saved draft.';
}

// ---- save ----
let t: number | undefined;
function save() {
  if (isUpdate()) return;
  clearTimeout(t);
  t = window.setTimeout(() => {
    const fields: [string, string][] = [];
    for (const [k, v] of new FormData(form)) if (typeof v === 'string' && !SKIP.has(k) && v !== '') fields.push([k, v]);
    const d: Draft = { v: 1, step: current, fields, uploads: { session: sessionInput.value, photos: JSON.parse(photosInput.value || '[]') }, saved: new Date().toISOString() };
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
      note.innerHTML = 'Draft saved on this device. <button type="button" class="btn btn-ghost btn-sm" data-clear-draft>Start over</button>';
    } catch {}
  }, 400);
}
note.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('[data-clear-draft]')) return;
  if (!confirm('Clear this draft and start over?')) return;
  try { localStorage.removeItem(KEY); } catch {}
  location.reload();
});
form.addEventListener('input', save);
form.addEventListener('change', save);

// ---- steps ----
function show(i: number, focus = true) {
  current = i;
  steps.forEach((s, n) => s.classList.toggle('is-current', n === i));
  dots.forEach((d, n) => {
    d.classList.toggle('done', n < i);
    if (n === i) d.setAttribute('aria-current', 'step');
    else d.removeAttribute('aria-current');
  });
  back.hidden = i === 0;
  next.hidden = i === steps.length - 1;
  if (i === steps.length - 1) review();
  if (focus) {
    const h = steps[i].querySelector<HTMLElement>('h2')!;
    h.tabIndex = -1;
    form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    h.focus({ preventScroll: true });
  }
  save();
}

function valid(i: number) {
  const s = steps[i];
  for (const el of s.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')) {
    if (el.closest('[hidden]') || el.type === 'hidden') continue;
    if (!el.checkValidity()) { el.reportValidity(); el.focus(); return false; }
  }
  for (const g of s.querySelectorAll<HTMLElement>('[data-min-checked]')) {
    const err = g.querySelector<HTMLElement>('[data-group-error]')!;
    const ok = isUpdate() || g.querySelectorAll('input:checked').length >= Number(g.dataset.minChecked);
    err.hidden = ok;
    if (!ok) { g.querySelector<HTMLInputElement>('input')?.focus(); return false; }
  }
  if (i === 3 && uploader.busy) {
    const m = form.querySelector<HTMLElement>('[data-upload-msg]')!;
    m.textContent = 'Please wait for your photos to finish uploading.';
    m.className = 'form-msg err';
    return false;
  }
  if (i === 4 && !isUpdate()) {
    const phone = (form.elements.namedItem('sellerPhone') as HTMLInputElement);
    const email = (form.elements.namedItem('sellerEmail') as HTMLInputElement);
    if (!phone.value.trim() && !email.value.trim()) { phone.setCustomValidity('Give a phone number or an email so buyers can reach you.'); phone.reportValidity(); phone.setCustomValidity(''); return false; }
  }
  return true;
}

form.classList.add('js-steps');
next.addEventListener('click', () => { if (valid(current)) show(current + 1); });
back.addEventListener('click', () => show(current - 1));
form.addEventListener('submit', (e) => {
  for (let i = 0; i < steps.length; i++) if (!valid(i)) { e.preventDefault(); if (i !== current) show(i); return; }
  form.querySelector<HTMLButtonElement>('[data-submit]')!.disabled = true;
});
// Enter in a text field moves to the next step instead of submitting early.
form.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  if (e.key === 'Enter' && el.tagName === 'INPUT' && current < steps.length - 1) { e.preventDefault(); next.click(); }
});

// ---- helpers ----
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const num = (name: string) => Number(((form.elements.namedItem(name) as HTMLInputElement).value || '').replace(/[$,\s]/g, ''));
const ppa = document.getElementById('ppa-note')!;
form.addEventListener('input', () => {
  const a = num('acres'), p = num('price');
  ppa.textContent = a > 0 && p > 0 ? `That is about ${money(p / a)} per acre.` : '';
  const sum = form.elements.namedItem('summary') as HTMLTextAreaElement;
  document.getElementById('summary-count')!.textContent = sum.value.length.toLocaleString('en-US');
});

function review() {
  const f = new FormData(form);
  const get = (k: string) => String(f.get(k) ?? '').trim();
  const types = f.getAll('landTypes').map((v) => form.querySelector<HTMLInputElement>(`input[name="landTypes"][value="${CSS.escape(String(v))}"]`)?.parentElement?.textContent?.trim()).filter(Boolean);
  const photos = (JSON.parse(photosInput.value || '[]') as unknown[]).length;
  const rows: [string, string][] = [
    ['Title', get('title') || '—'],
    ['Location', [get('county'), get('region')].filter(Boolean).join(', ') || '—'],
    ['Acres', get('acres') || '—'],
    ['Price', num('price') > 0 ? money(num('price')) : 'Price on request'],
    ['Type', types.join(', ') || '—'],
    ['Photos', String(photos)],
  ];
  document.getElementById('review')!.replaceChildren(...rows.map(([k, v]) => {
    const d = document.createElement('div');
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    d.append(dt, dd);
    return d;
  }));
}

show(current, false);
form.dispatchEvent(new Event('input'));
