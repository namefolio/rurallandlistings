import type { APIRoute } from 'astro';
import { site } from '../../../site.config';
import { aboutListings, adNotice, buyerAdvice, classifiedTerm } from '../../lib/copy';
import { mdResponse } from '../../lib/markdown';

export const GET: APIRoute = () =>
  mdResponse(`# About ${site.name}

${site.name} is an independent site for rural land for sale and the ${site.entity.many} who sell it, run by ${site.owner}. No brokerage, no commission.

## Land for sale

${adNotice} Each ad costs ${classifiedTerm}, runs from the day it goes live, and is removed after its end date unless renewed. Newest first; nobody can pay to appear higher. ${buyerAdvice}

## Where ${site.entity.one} listings come from

Details come from each ${site.entity.one}’s own public website and profile pages, and from submissions sent with our form. Each listing records its source and the date it was last checked or changed. No ratings or reviews.

## Basic and Verified ${site.entity.one} listings

${aboutListings.join('\n\n')}

Listing plans: ${site.url}/listing-plans/`);
