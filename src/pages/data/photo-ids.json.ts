import type { APIRoute } from 'astro';
import { publishedPhotoIds } from '../../lib/data';

// Photos the Worker may serve publicly: those used by a live listing or agent profile.
export const GET: APIRoute = async () => new Response(JSON.stringify({ ids: await publishedPhotoIds() }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
