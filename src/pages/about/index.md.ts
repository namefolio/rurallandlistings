import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { aboutListings } from '../../lib/copy';
import { mdResponse } from '../../lib/markdown';

export const GET: APIRoute = () =>
  mdResponse(`# About ${site.name}

${site.name} is an independent directory of ${site.entity.many}, run by ${site.owner}.

## Where listings come from

Details come from each ${site.entity.one}’s own public website and social pages, and from submissions sent with our form. Each listing records its source and the date it was last checked or changed. No ratings, reviews or invented hours or prices.

## Basic and Verified listings

${aboutListings.join('\n\n')}

Listing plans: ${site.url}/listing-plans/`);
