// /land-agents/: filters the rendered agent cards. Filters live in the URL so a filtered directory can be shared.
const form = document.getElementById('agent-filters') as HTMLFormElement;
const cards = [...document.querySelectorAll<HTMLElement>('#agent-results .acard')];
const count = document.getElementById('agent-count')!;
const none = document.getElementById('agent-none')!;
const results = document.getElementById('agent-results');
const county = form.elements.namedItem('county') as HTMLSelectElement;

function apply(push = true) {
  const f = new FormData(form);
  const state = String(f.get('state') ?? ''), c = String(f.get('county') ?? ''), spec = String(f.get('spec') ?? ''), type = String(f.get('type') ?? ''), verified = f.get('verified') === '1';
  for (const o of county.options) if (o.value) o.hidden = !!state && o.dataset.state !== state;
  if (county.selectedOptions[0]?.hidden) county.value = '';
  let n = 0;
  for (const el of cards) {
    const d = el.dataset;
    const ok = (!state || d.states!.split(' ').includes(state) || d.counties!.split(' ').some((x) => x.startsWith(`${state}:`)))
      && (!county.value || d.counties!.split(' ').includes(county.value))
      && (!spec || d.spec!.split(' ').includes(spec))
      && (!type || d.type === type)
      && (!verified || d.verified === '1');
    el.hidden = !ok;
    if (ok) n++;
  }
  count.textContent = `${n} ${n === 1 ? 'agent' : 'agents'}`;
  none.hidden = n > 0 || cards.length === 0;
  if (results) results.hidden = n === 0;
  if (push) {
    const p = new URLSearchParams();
    for (const [k, v] of f) if (v) p.set(k, String(v));
    if (county.value) p.set('county', county.value); else p.delete('county');
    history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
  }
}

const init = new URLSearchParams(location.search);
for (const [k, v] of init) {
  const el = form.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement | null;
  if (!el) continue;
  if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = v === el.value;
  else el.value = v;
}
form.addEventListener('change', () => apply());
form.addEventListener('submit', (e) => e.preventDefault());
document.querySelector('[data-agent-clear]')?.addEventListener('click', () => { form.reset(); apply(); });
apply(false);
