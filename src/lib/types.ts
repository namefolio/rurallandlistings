// Engine types. Nothing in src/lib holds niche words; those live in site.config.ts.

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

export type AttributeDef =
  | { key: string; label: string; type: 'multi'; options: Record<string, string> }
  | { key: string; label: string; type: 'bool' }
  | { key: string; label: string; type: 'number'; format?: (n: number) => string; max?: number };

export type Tier = 'basic' | 'verified';

/** A photo stored in R2. Served at `/photos/{id}/{w}` for each width in PHOTO_WIDTHS. */
export const PHOTO_KINDS = ['aerial', 'access', 'terrain', 'feature', 'water', 'buildings', 'boundary', 'other'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];
export interface Photo { id: string; alt: string; kind?: PhotoKind; width: number; height: number }

export interface ListingData {
  name: string;
  slug: string;
  status: 'published' | 'closed';
  tier: Tier;
  verifiedUntil?: Date;
  demo?: boolean;
  address: { street: string; city: string; region: string; postalCode: string };
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
  sameAs: string[];
  hours?: Partial<Record<Day, string>>;
  summary: string;
  attributes: Record<string, unknown>;
  lastUpdated: Date;
  source: string;
  description?: string;
  bookingUrl?: string;
  /** Brokerage or company the agent works under. */
  brokerage?: string;
  agentType?: string;
  email?: string;
  photo?: Photo;
  /** States the agent holds a real estate license in (and the license number, when published). */
  licenses?: { state: string; number?: string }[];
  countiesServed?: { state: string; county: string }[];
  /** The license check behind Verified: when it was done and which states were checked. */
  licenseCheck?: { checkedOn: Date; states: string[] };
}

/** A listing plus the facts the build derives from its folder and the date. */
export interface Listing extends ListingData {
  regionSlug: string;
  citySlug: string;
  effectiveTier: Tier;
  url: string;
  completeness: number;
}

export interface Taxonomy {
  /** URL segment, e.g. "styles" → /styles/{term}/ */
  segment: string;
  /** Attribute key holding the terms (a `multi` attribute). */
  attribute: string;
  /** H1 / title for a term page. */
  title: (termLabel: string) => string;
  description: (termLabel: string, count: number) => string;
}

export interface BestFor {
  label: string;
  test: (l: ListingData) => boolean;
}

export interface Faq {
  q: string;
  a: string;
}

// ---- Classifieds (land for sale): paid ads that run a fixed number of days ----

export interface LandData {
  title: string;
  slug: string;
  status: 'published' | 'sold' | 'withdrawn';
  demo?: boolean;
  /** `county` is the display name ("Wharton County"); `region` the state code. */
  location: { county: string; region: string; nearestTown?: string; postalCode?: string };
  /** Approximate centre of the land, never a boundary. */
  lat: number;
  lng: number;
  acres: number;
  /** Asking price in whole dollars; absent means "price on request". */
  price?: number;
  seller: { type: 'owner' | 'agent'; name: string; phone?: string; email?: string; agentSlug?: string };
  /** The seller's own description of the land. */
  summary: string;
  /** Seller's links: survey, map, an outside album. */
  links: string[];
  /** Uploaded photos, cover first. */
  photos: Photo[];
  /** A YouTube or Vimeo link from the seller. */
  videoUrl?: string;
  /** The seller agreed to show the exact point; otherwise maps and data show an approximate area. */
  exactLocation?: boolean;
  attributes: Record<string, unknown>;
  postedOn: Date;
  expiresOn: Date;
  lastUpdated: Date;
  source: string;
}

export interface Land extends LandData {
  regionSlug: string;
  countySlug: string;
  url: string;
}

/** A land category page (e.g. "hunting land for sale"), built only with 3+ live listings. */
export interface LandCategory {
  slug: string;
  /** The /land-for-sale/ query that matches this category. */
  query: string;
  title: string;
  noun: string;
  test: (l: LandData) => boolean;
}
