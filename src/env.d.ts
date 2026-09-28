/// <reference types="astro/client" />
interface ImportMetaEnv { readonly PUBLIC_INCLUDE_DEMO?: string }
declare module 'cloudflare:email' {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string | ReadableStream);
    readonly from: string;
    readonly to: string;
  }
}
