/// <reference types="astro/client" />
interface ImportMetaEnv { readonly PUBLIC_INCLUDE_DEMO?: string }
declare module 'cloudflare:email' {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string | ReadableStream);
    readonly from: string;
    readonly to: string;
  }
}
declare module "*?worker&url" { const src: string; export default src; }

/** Cloudflare Turnstile (explicit rendering), loaded from challenges.cloudflare.com. */
interface Window {
  turnstile?: {
    render: (el: HTMLElement, o: Record<string, unknown>) => string;
    getResponse: (id?: string) => string | undefined;
    reset: (id?: string) => void;
    remove: (id: string) => void;
  };
}
