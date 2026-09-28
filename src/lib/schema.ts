import { z } from 'zod';
import { site } from '../../site.config';
import { DAYS, type AttributeDef } from './types';

/** "11:00-19:00", "11:00-14:00,15:00-19:00" or "closed". */
export const HOURS_RE = /^(closed|([01]\d|2[0-4]):[0-5]\d-([01]\d|2[0-4]):[0-5]\d(,([01]\d|2[0-4]):[0-5]\d-([01]\d|2[0-4]):[0-5]\d)*)$/;

export const attributesFor = (defs: AttributeDef[]) => z
  .object(
    Object.fromEntries(
      defs.map((a) => {
        if (a.type === 'multi') return [a.key, z.array(z.enum(Object.keys(a.options) as [string, ...string[]])).optional()];
        if (a.type === 'bool') return [a.key, z.boolean().optional()];
        return [a.key, z.number().int().min(0).max(a.max ?? 1_000_000).optional()];
      }),
    ),
  )
  .strict();

export const attributesSchema = attributesFor(site.attributes);

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

const phoneRe = /^[+()\d][\d ()+.-]{6,24}$/;

/** A land-for-sale classified. It runs from postedOn to expiresOn (the paid period), then leaves the site. */
export const landSchema = z
  .object({
    title: z.string().min(5).max(90),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    status: z.enum(['published', 'sold', 'withdrawn']),
    demo: z.boolean().optional(),
    location: z
      .object({
        county: z.string().min(3).max(60),
        region: z.string().min(2).max(2),
        nearestTown: z.string().min(2).max(60).optional(),
        postalCode: z.string().min(5).max(10).optional(),
      })
      .strict(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    acres: z.number().positive().max(1_000_000),
    price: z.number().int().positive().max(1_000_000_000).optional(),
    seller: z
      .object({
        type: z.enum(['owner', 'agent']),
        name: z.string().min(2).max(100),
        phone: z.string().regex(phoneRe).optional(),
        email: z.email().optional(),
        agentSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).optional(),
      })
      .strict()
      .refine((s) => !!(s.phone || s.email), { message: 'seller needs a phone or an email' }),
    summary: z.string().min(40).max(2000),
    links: z.array(z.url()).max(5).default([]),
    attributes: attributesFor(site.classifieds.attributes).default({}),
    postedOn: z.coerce.date(),
    expiresOn: z.coerce.date(),
    lastUpdated: z.coerce.date(),
    source: z.string().min(1),
  })
  .strict()
  .refine((l) => l.expiresOn > l.postedOn, { message: 'expiresOn must be after postedOn', path: ['expiresOn'] })
  .refine((l) => (l.expiresOn.getTime() - l.postedOn.getTime()) / 86_400_000 <= site.classifieds.days * 3, {
    message: 'a listing can run at most three paid periods at once; renew it instead',
    path: ['expiresOn'],
  });
