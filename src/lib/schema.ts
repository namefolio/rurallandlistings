import { z } from 'zod';
import { site } from '../../site.config';
import { DAYS } from './types';

/** "11:00-19:00", "11:00-14:00,15:00-19:00" or "closed". */
export const HOURS_RE = /^(closed|([01]\d|2[0-4]):[0-5]\d-([01]\d|2[0-4]):[0-5]\d(,([01]\d|2[0-4]):[0-5]\d-([01]\d|2[0-4]):[0-5]\d)*)$/;

export const attributesSchema = z
  .object(
    Object.fromEntries(
      site.attributes.map((a) => {
        if (a.type === 'multi') return [a.key, z.array(z.enum(Object.keys(a.options) as [string, ...string[]])).optional()];
        if (a.type === 'bool') return [a.key, z.boolean().optional()];
        return [a.key, z.number().int().min(0).max(a.max ?? 1_000_000).optional()];
      }),
    ),
  )
  .strict();

export const hoursSchema = z
  .object(Object.fromEntries(DAYS.map((d) => [d, z.string().regex(HOURS_RE).optional()])))
  .strict();

export const listingSchema = z
  .object({
    name: z.string().min(2).max(120),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    status: z.enum(['published', 'closed']),
    tier: z.enum(['basic', 'verified']).default('basic'),
    verifiedUntil: z.coerce.date().optional(),
    demo: z.boolean().optional(),
    address: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      region: z.string().min(1),
      postalCode: z.string().min(1),
    }),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    phone: z.string().optional(),
    website: z.url().optional(),
    sameAs: z.array(z.url()).default([]),
    hours: hoursSchema.optional(),
    summary: z.string().min(10).max(400),
    attributes: attributesSchema.default({}),
    lastUpdated: z.coerce.date(),
    source: z.string().min(1),
    description: z.string().max(1200).optional(),
    bookingUrl: z.url().optional(),
  })
  .strict()
  .refine((l) => l.tier !== 'verified' || !!l.verifiedUntil, { message: 'verified listings need verifiedUntil', path: ['verifiedUntil'] });
