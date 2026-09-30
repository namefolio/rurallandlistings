// Photo uploader: resizes each photo in the browser (480/960/1600 px, WebP or JPEG), uploads the sizes to R2
// through the Worker, and keeps a list the seller can tag, caption, reorder and remove.
import { PHOTO_WIDTHS } from '../lib/photos';

export interface PhotoRecord { id: string; alt: string; kind: string; width: number; height: number }
interface Item extends PhotoRecord { key: string; status: 'processing' | 'uploading' | 'done' | 'error'; done: number; preview: string; error?: string }
export interface UploaderState { session: string; photos: PhotoRecord[] }

const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const MIN_WIDTH = 400;

async function toBlob(canvas: HTMLCanvasElement | OffscreenCanvas, type: string, q: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality: q });
  return new Promise((ok, fail) => (canvas as HTMLCanvasElement).toBlob((b) => (b ? ok(b) : fail(new Error('encode'))), type, q));
}

/** Resize to each width (never upscaling). WebP where the browser can encode it, JPEG otherwise. */
export async function resize(file: File): Promise<{ blobs: Map<number, Blob>; width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  if (bmp.width < MIN_WIDTH) throw new Error(`This photo is too small (${bmp.width}px wide). Use one at least ${MIN_WIDTH}px wide.`);
  const blobs = new Map<number, Blob>();
  let webp = true;
  for (const w of [...PHOTO_WIDTHS].reverse()) {
    const tw = Math.min(w, bmp.width);
    const th = Math.round((bmp.height * tw) / bmp.width);
    const canvas: HTMLCanvasElement | OffscreenCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(tw, th) : Object.assign(document.createElement('canvas'), { width: tw, height: th });
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, tw, th);
    let blob = webp ? await toBlob(canvas, 'image/webp', 0.8) : null;
    if (!blob || blob.type !== 'image/webp') { webp = false; blob = await toBlob(canvas, 'image/jpeg', 0.84); }
    blobs.set(w, blob);
  }
  const width = Math.min(PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1], bmp.width);
  const height = Math.round((bmp.height * width) / bmp.width);
  bmp.close();
  return { blobs, width, height };
}

export class Uploader {
  items: Item[] = [];
  session = '';
  private sessionReady: Promise<string> | null = null;
  private root: HTMLElement;
  private list: HTMLUListElement;
  private msgEl: HTMLElement;
  private max: number;
  private kinds: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(root: HTMLElement, private opts: { onChange: (s: UploaderState) => void; title: () => string; restore?: UploaderState }) {
    this.root = root;
    this.list = root.querySelector('[data-list]')!;
    this.msgEl = root.querySelector('[data-upload-msg]')!;
    this.max = Number(root.dataset.max ?? 25);
    this.kinds = root.querySelector<HTMLTemplateElement>('template[data-kinds]')?.innerHTML ?? '';
    const input = root.querySelector<HTMLInputElement>('[data-file]')!;
    input.addEventListener('change', () => { this.add([...(input.files ?? [])]); input.value = ''; });
    const drop = root.querySelector<HTMLElement>('[data-drop]')!;
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); this.add([...(e.dataTransfer?.files ?? [])]); });
    const r = opts.restore;
    if (r?.session && this.sessionValid(r.session)) {
      this.session = r.session;
      this.items = r.photos.map((p) => ({ ...p, key: hex(6), status: 'done', done: PHOTO_WIDTHS.length, preview: `/photos/${p.id}/480?s=${encodeURIComponent(r.session)}` }));
      this.render();
    }
  }

  private sessionValid(token: string) {
    const exp = Number(token.split('.')[1]);
    return exp > Date.now() + 3_600_000;
  }

  private msg(text: string, kind: '' | 'ok' | 'err' = '') {
    this.msgEl.textContent = text;
    this.msgEl.className = `form-msg ${kind}`;
  }

  /** A signed upload session, after a one-time Turnstile check. */
  private getSession(): Promise<string> {
    if (this.session && this.sessionValid(this.session)) return Promise.resolve(this.session);
    return (this.sessionReady ??= (async () => {
      const cfg = (await (await fetch('/api/config')).json()) as { turnstileSiteKey?: string; uploads?: boolean };
      if (!cfg.uploads || !cfg.turnstileSiteKey) throw new Error('Photo uploads are not available right now. Please try again later.');
      const box = this.root.querySelector<HTMLElement>('[data-upload-check]')!;
      box.hidden = false;
      for (let i = 0; i < 100 && !window.turnstile; i++) await new Promise((r) => setTimeout(r, 100));
      if (!window.turnstile) throw new Error('The security check did not load. Reload the page and try again.');
      this.msg('One quick security check before your first upload…');
      const token = await new Promise<string>((ok, fail) => {
        const id = window.turnstile!.render(box, {
          sitekey: cfg.turnstileSiteKey,
          callback: (t: string) => { ok(t); setTimeout(() => { window.turnstile!.remove(id); box.hidden = true; }, 500); },
          'error-callback': () => fail(new Error('The security check failed. Reload the page and try again.')),
        });
      });
      const r = await fetch('/api/uploads/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const body = (await r.json().catch(() => ({}))) as { session?: string; message?: string };
      if (!r.ok || !body.session) throw new Error(body.message ?? 'Could not start uploading. Please try again.');
      this.session = body.session;
      this.msg('');
      return body.session;
    })().finally(() => { this.sessionReady = null; }));
  }

  add(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    const room = this.max - this.items.length;
    if (images.length > room) this.msg(`You can add ${room} more ${room === 1 ? 'photo' : 'photos'} (up to ${this.max}).`, 'err');
    for (const file of images.slice(0, Math.max(0, room))) {
      const item: Item = { key: hex(6), id: '', alt: '', kind: '', width: 0, height: 0, status: 'processing', done: 0, preview: '' };
      this.items.push(item);
      this.queue = this.queue.then(() => this.process(item, file));
    }
    this.render();
  }

  private async process(item: Item, file: File) {
    try {
      const { blobs, width, height } = await resize(file);
      item.width = width;
      item.height = height;
      item.preview = URL.createObjectURL(blobs.get(480)!);
      item.status = 'uploading';
      this.render();
      const session = await this.getSession();
      const photo = hex(6);
      const sid = session.split('.')[0];
      for (const [w, blob] of blobs) {
        const r = await fetch(`/api/uploads/${sid}/${photo}/${w}`, { method: 'PUT', headers: { 'Content-Type': blob.type, 'X-Upload-Session': session }, body: blob });
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { message?: string }).message ?? 'Upload failed.');
        item.done++;
        this.renderItem(item);
      }
      item.id = `${sid}/${photo}`;
      item.status = 'done';
    } catch (e) {
      item.status = 'error';
      item.error = e instanceof Error ? e.message : 'Upload failed.';
      if (/not available|security check/i.test(item.error)) this.msg(item.error, 'err');
    }
    this.render();
  }

  private state(): UploaderState {
    return { session: this.session, photos: this.items.filter((i) => i.status === 'done').map(({ id, alt, kind, width, height }) => ({ id, alt, kind, width, height })) };
  }

  get busy() { return this.items.some((i) => i.status === 'processing' || i.status === 'uploading'); }

  private move(item: Item, by: number) {
    const i = this.items.indexOf(item);
    const j = Math.max(0, Math.min(this.items.length - 1, i + by));
    this.items.splice(i, 1);
    this.items.splice(j, 0, item);
    this.render();
    this.list.querySelector<HTMLElement>(`[data-key="${item.key}"] [data-move="${by}"]`)?.focus();
  }

  private renderItem(item: Item) {
    const li = this.list.querySelector<HTMLElement>(`[data-key="${item.key}"]`);
    if (!li) return;
    const bar = li.querySelector<HTMLElement>('.bar i');
    if (bar) bar.style.width = `${item.status === 'done' ? 100 : Math.round((item.done / PHOTO_WIDTHS.length) * 100)}%`;
  }

  render() {
    const els = this.items.map((item, i) => {
      const li = document.createElement('li');
      li.className = 'photo-item';
      li.dataset.key = item.key;
      const status = item.status === 'done' ? '' : item.status === 'error' ? 'Failed' : item.status === 'processing' ? 'Resizing…' : 'Uploading…';
      li.innerHTML = `
        ${item.preview ? `<img alt="" src="${item.preview}">` : '<div class="no-photo" style="aspect-ratio:4/3"></div>'}
        ${i === 0 ? '<span class="cover">Cover</span>' : ''}
        ${status ? `<span class="status${item.status === 'error' ? ' err' : ''}">${status}</span>` : ''}
        ${item.status === 'uploading' || item.status === 'processing' ? '<div class="bar"><i></i></div>' : ''}
        <div class="pi-body">
          ${item.status === 'error' ? `<p class="form-msg err small"></p>` : ''}
          <label class="sr-only" for="k-${item.key}">What does photo ${i + 1} show?</label>
          <select id="k-${item.key}" data-kind><option value="">What does it show?</option>${this.kinds}</select>
          <label class="sr-only" for="a-${item.key}">Caption for photo ${i + 1}</label>
          <input id="a-${item.key}" type="text" maxlength="160" placeholder="Caption (e.g. Creek on the north line)" data-alt>
          <div class="pi-tools">
            <button type="button" data-move="-1" aria-label="Move photo ${i + 1} earlier" ${i === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>
            <button type="button" data-move="1" aria-label="Move photo ${i + 1} later" ${i === this.items.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
            <button type="button" data-remove aria-label="Remove photo ${i + 1}">Remove</button>
          </div>
        </div>`;
      if (item.error) li.querySelector('.form-msg')!.textContent = item.error;
      const kind = li.querySelector<HTMLSelectElement>('[data-kind]')!;
      kind.value = item.kind;
      kind.addEventListener('change', () => { item.kind = kind.value; this.emit(); });
      const alt = li.querySelector<HTMLInputElement>('[data-alt]')!;
      alt.value = item.alt;
      alt.addEventListener('input', () => { item.alt = alt.value; this.emit(); });
      li.querySelector('[data-move="-1"]')!.addEventListener('click', () => this.move(item, -1));
      li.querySelector('[data-move="1"]')!.addEventListener('click', () => this.move(item, 1));
      li.querySelector('[data-remove]')!.addEventListener('click', () => {
        this.items = this.items.filter((x) => x !== item);
        this.render();
        this.msg('Photo removed.');
      });
      return li;
    });
    this.list.replaceChildren(...els);
    this.items.forEach((i) => this.renderItem(i));
    this.emit();
  }

  private emit() {
    const kinds = new Set(this.items.map((i) => i.kind));
    this.root.querySelectorAll<HTMLElement>('[data-checklist] li').forEach((li) => li.classList.toggle('done', kinds.has(li.dataset.kind!)));
    this.opts.onChange(this.state());
  }
}
