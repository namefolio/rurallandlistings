import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';
import { listingSchema } from './lib/schema';

// Listing ids keep their folder path: "{region}/{city}/{slug}".
const listings = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/listings', generateId: ({ entry }) => entry.replace(/\.json$/, '') }),
  schema: listingSchema,
});

const places = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/places', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z.object({ title: z.string().optional() }),
});

export const collections = { listings, places };
