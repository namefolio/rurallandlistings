// Property page: gallery arrows, counter and full-screen viewer; the location map loads when scrolled to.
const g = document.querySelector<HTMLElement>('[data-gallery]');
if (g) {
  const track = g.querySelector<HTMLElement>('.gallery-track')!;
  const figs = [...track.querySelectorAll<HTMLElement>('figure')];
  const counter = g.querySelector('[data-counter]');
  const at = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
  const go = (i: number) => track.scrollTo({ left: Math.max(0, Math.min(figs.length - 1, i)) * track.clientWidth, behavior: 'smooth' });
  track.addEventListener('scroll', () => { if (counter) counter.textContent = `${at() + 1} / ${figs.length}`; }, { passive: true });
  g.querySelector('[data-prev]')?.addEventListener('click', () => go(at() - 1));
  g.querySelector('[data-next]')?.addEventListener('click', () => go(at() + 1));
  track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') go(at() + 1); if (e.key === 'ArrowLeft') go(at() - 1); });

  const dlg = g.querySelector<HTMLDialogElement>('dialog')!;
  const lt = dlg.querySelector<HTMLElement>('[data-lightbox-track]')!;
  const open = (i: number) => {
    if (!lt.childElementCount) figs.forEach((f) => {
      const c = f.cloneNode(true) as HTMLElement;
      const img = c.querySelector('img')!;
      img.loading = 'lazy';
      img.sizes = '100vw';
      lt.append(c);
    });
    dlg.showModal();
    lt.scrollTo({ left: i * lt.clientWidth });
    lt.focus();
  };
  g.querySelector('[data-open-lightbox]')?.addEventListener('click', () => open(at()));
  figs.forEach((f, i) => f.addEventListener('click', () => { if (window.matchMedia('(min-width: 56rem)').matches) open(i); }));
  dlg.querySelector('[data-close-lightbox]')!.addEventListener('click', () => dlg.close());
  lt.addEventListener('keydown', (e) => {
    const i = Math.round(lt.scrollLeft / lt.clientWidth);
    if (e.key === 'ArrowRight') lt.scrollTo({ left: (i + 1) * lt.clientWidth, behavior: 'smooth' });
    if (e.key === 'ArrowLeft') lt.scrollTo({ left: (i - 1) * lt.clientWidth, behavior: 'smooth' });
  });
}

const box = document.querySelector<HTMLElement>('[data-point-map]');
if (box) {
  const io = new IntersectionObserver(async (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    box.querySelector('.map-loading')!.textContent = 'Loading map…';
    try {
      const { pointMap } = await import('./map');
      await pointMap(box, box.dataset.style!, JSON.parse(box.dataset.pointMap!));
      box.querySelector('.map-loading')?.remove();
    } catch {
      box.querySelector('.map-loading')!.textContent = 'The map could not be loaded.';
    }
  }, { rootMargin: '200px' });
  io.observe(box);
}

document.querySelector('[data-share]')?.addEventListener('click', async (e) => {
  const b = e.currentTarget as HTMLButtonElement;
  const data = { title: document.title, url: location.href };
  try {
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(location.href); b.lastChild!.textContent = 'Link copied'; }
  } catch {}
});
