// Engine types. Nothing in src/lib holds niche words; those live in site.config.ts.

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

export type AttributeDef =
  | { key: string; label: string; type: 'multi'; options: Record<string, string> }
  | { key: string; label: string; type: 'bool' }
  | { key: string; label: string; type: 'number'; format?: (n: number) => string; max?: number };

export type Tier = 'basic' | 'verified';

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
