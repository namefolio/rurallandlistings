// Photo URLs. Uploads are resized in the browser to these widths and stored in R2 as "{id}/{width}";
// the Worker serves them at /photos/{id}/{width} once a published listing uses them.
import type { Photo } from './types';

export const PHOTO_WIDTHS = [480, 960, 1600] as const;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];

export const photoUrl = (id: string, w: PhotoWidth) => `/photos/${id}/${w}`;
export const photoSrcset = (p: Photo) => PHOTO_WIDTHS.map((w) => `${photoUrl(p.id, w)} ${Math.min(w, p.width)}w`).join(', ');

/** Height for a given rendered width, keeping the photo's aspect ratio. */
export const photoHeight = (p: Photo, w: number) => Math.round((p.height / p.width) * w);

export const PHOTO_KIND_LABELS: Record<string, string> = {
  aerial: 'Aerial view',
  access: 'Road frontage or access',
  terrain: 'Typical terrain',
  feature: 'Best feature',
  water: 'Water',
  buildings: 'Buildings or improvements',
  boundary: 'Boundary or map',
  other: 'Other',
};
