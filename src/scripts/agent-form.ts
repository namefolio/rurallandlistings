// Agent profile form: wires the single profile-photo upload into the hidden form fields.
import { Uploader } from './uploader';

const form = document.getElementById('agent-form') as HTMLFormElement;
const photos = form.elements.namedItem('photos') as HTMLInputElement;
const session = form.elements.namedItem('uploadSession') as HTMLInputElement;
const uploader = new Uploader(form.querySelector('[data-uploader]')!, {
  title: () => (form.elements.namedItem('name') as HTMLInputElement).value,
  onChange: (s) => { photos.value = JSON.stringify(s.photos); session.value = s.session; },
});
form.addEventListener('submit', (e) => {
  if (!uploader.busy) return;
  e.preventDefault();
  const m = form.querySelector<HTMLElement>('[data-upload-msg]')!;
  m.textContent = 'Please wait for your photo to finish uploading.';
  m.className = 'form-msg err';
});
