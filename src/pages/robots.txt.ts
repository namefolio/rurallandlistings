import type { APIRoute } from 'astro';
import { site } from '../../site.config';

const bots = ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Claude-User', 'Google-Extended', 'Applebot'];

export const GET: APIRoute = () =>
  new Response(
    `${bots.map((b) => `User-agent: ${b}\nAllow: /\n`).join('\n')}\nUser-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap-index.xml\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
