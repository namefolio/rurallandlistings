// Everything niche-specific lives here (plus src/theme.css, docs/BRIEF.md and the listing files).
// To start the next domain, change this file; the engine in src/lib and src/pages holds no niche words.
// This site has two kinds of listing:
//   - directory listings (`site.entity`): land agents, free Basic or paid Verified, in src/content/listings/
//   - classifieds (`site.classifieds`): land for sale, paid-only ads that run a fixed number of days, in src/content/land/
import { US_STATES } from './src/data/us-states';
import type { AttributeDef, BestFor, Faq, LandCategory, LandData, ListingData, Taxonomy } from './src/lib/types';

// ---- Launch values (npm run check warns if any PLACEHOLDER remains) ----
// Defaults copied from Ben's other directory sites (for example TattooStudioGuide). Confirm or replace before launch: see docs/BRIEF.md.
export const PLACEHOLDERS = {
  /** Email or URL for the home-page "domain for sale" banner. */
  forSaleContact: 'https://www.domainmarket.com/',
  /** Inbox that receives form emails (must be a verified Email Routing destination). */
  submissionsEmail: 'hello@namefolio.co',
  /** Price shown for a Verified agent listing. The $149 is Ben's; the one-year term is our default. */
  verifiedPrice: '$149 a year',
  /** Hosted checkout link (Stripe Payment Link) or a mailto: address if you invoice. */
  verifiedPaymentLink: 'mailto:hello@namefolio.co',
  /** Price and checkout link for one land-for-sale classified. */
  classifiedPrice: '$49',
  classifiedPaymentLink: 'mailto:hello@namefolio.co',
};

// ---------- Land agents (directory) ----------

const specialties: Record<string, string> = {
  'farms-ranches': 'Farms and ranches',
  'hunting-recreational': 'Hunting and recreational land',
  timberland: 'Timberland',
  'lots-homesites': 'Lots and homesites',
  'land-auctions': 'Land auctions',
  development: 'Development land',
};

const agentAttributes: AttributeDef[] = [
  { key: 'specialties', label: 'Specialties', type: 'multi', options: specialties },
  { key: 'worksWithBuyers', label: 'Works with buyers', type: 'bool' },
  { key: 'worksWithSellers', label: 'Works with sellers', type: 'bool' },
  { key: 'accreditedLandConsultant', label: 'Accredited Land Consultant (ALC)', type: 'bool' },
];

const has = (l: { attributes: Record<string, unknown> }, key: string, term: string) =>
  Array.isArray(l.attributes[key]) && (l.attributes[key] as string[]).includes(term);
const alc = (l: ListingData) => l.attributes.accreditedLandConsultant === true;

const taxonomies: Taxonomy[] = [
  {
    segment: 'land-agents-for',
    attribute: 'specialties',
    title: (t) => `Land Agents for ${t}`,
    description: (t, n) => `${n} land agents and brokers who list ${t.toLowerCase()} as a specialty, grouped by state and city.`,
  },
];

const bestFor: BestFor[] = [
  { label: 'Farms and ranches', test: (l) => has(l, 'specialties', 'farms-ranches') },
  { label: 'Hunting and recreational land', test: (l) => has(l, 'specialties', 'hunting-recreational') },
  { label: 'Timberland', test: (l) => has(l, 'specialties', 'timberland') },
  { label: 'Land auctions', test: (l) => has(l, 'specialties', 'land-auctions') },
  { label: 'Accredited Land Consultants', test: alc },
];

// ---------- Land for sale (classifieds) ----------

const landTypes: Record<string, string> = {
  farmland: 'Farmland',
  ranch: 'Ranch',
  pasture: 'Pasture',
  hunting: 'Hunting land',
  timber: 'Timberland',
  recreational: 'Recreational land',
  homesite: 'Homesite',
  waterfront: 'Waterfront',
  undeveloped: 'Undeveloped land',
};

const landAttributes: AttributeDef[] = [
  { key: 'landTypes', label: 'Land type', type: 'multi', options: landTypes },
  { key: 'ownerFinancing', label: 'Owner financing', type: 'bool' },
  { key: 'publicRoadAccess', label: 'Public road access', type: 'bool' },
  { key: 'powerAvailable', label: 'Electric available', type: 'bool' },
  { key: 'well', label: 'Well on the land', type: 'bool' },
  { key: 'surfaceWater', label: 'Creek, pond or spring', type: 'bool' },
  { key: 'septicOrPerc', label: 'Septic or passed perc test', type: 'bool' },
  { key: 'surveyed', label: 'Surveyed', type: 'bool' },
  { key: 'mineralRights', label: 'Mineral rights included', type: 'bool' },
  { key: 'deedRestrictions', label: 'Deed restrictions', type: 'bool' },
  { key: 'mobileHomesAllowed', label: 'Mobile homes allowed', type: 'bool' },
  { key: 'buildings', label: 'Buildings on the land', type: 'bool' },
  { key: 'annualTaxes', label: 'Annual property tax', type: 'number', format: (n) => `$${n.toLocaleString('en-US')}`, max: 1_000_000 },
];

const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const acresText = (a: number) => `${a.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${a === 1 ? 'acre' : 'acres'}`;
const perAcre = (l: LandData) => (l.price && l.acres ? Math.round(l.price / l.acres) : undefined);
const types = (l: LandData) => ((l.attributes.landTypes as string[] | undefined) ?? []).map((k) => landTypes[k] ?? k);

const landCategories: LandCategory[] = [
  { slug: 'hunting-land-for-sale', title: 'Hunting Land for Sale', noun: 'hunting land', test: (l) => has(l, 'landTypes', 'hunting') },
  { slug: 'farmland-for-sale', title: 'Farmland for Sale', noun: 'farmland', test: (l) => has(l, 'landTypes', 'farmland') },
  { slug: 'ranches-for-sale', title: 'Ranches for Sale', noun: 'ranch land', test: (l) => has(l, 'landTypes', 'ranch') },
  { slug: 'timberland-for-sale', title: 'Timberland for Sale', noun: 'timberland', test: (l) => has(l, 'landTypes', 'timber') },
  { slug: 'recreational-land-for-sale', title: 'Recreational Land for Sale', noun: 'recreational land', test: (l) => has(l, 'landTypes', 'recreational') },
  { slug: 'waterfront-land-for-sale', title: 'Waterfront Land for Sale', noun: 'waterfront land', test: (l) => has(l, 'landTypes', 'waterfront') },
  { slug: 'owner-financed-land', title: 'Owner Financed Land for Sale', noun: 'owner financed land', test: (l) => l.attributes.ownerFinancing === true },
];

export const site = {
  name: 'RuralLandListings',
  domain: 'rurallandlistings.com',
  url: 'https://rurallandlistings.com',
  lang: 'en-US',
  countryPhrase: 'in the US',
  ogLocale: 'en_US',
  currency: 'USD',
  tagline: 'Rural land for sale by owners and agents across the US, plus the land agents who sell it.',
  owner: 'RuralLandListings',
  /** Sender address for form emails; must be on the domain with Email Routing enabled. */
  formFromEmail: 'submissions@rurallandlistings.com',
  themeColor: '#1f5130',

  /** Header navigation. */
  nav: [
    { label: 'Land for sale', url: '/land-for-sale/' },
    { label: 'Land agents', url: '/land-agents/' },
    { label: 'Sell your land', url: '/sell-your-land/' },
  ],

  // ---- Directory: land agents ----
  entity: { one: 'land agent', many: 'land agents', One: 'Land agent', Many: 'Land agents', ManyTitle: 'Land Agents' },
  hub: 'land-agents',
  regionNoun: 'state',
  schemaType: 'RealEstateAgent',

  // The credential checked before a listing is marked Verified. Same wording on plans, About and llms.txt.
  credential: {
    name: 'real estate license',
    source: 'the state real estate commission’s public license lookup',
    /** Past participle used in the footer line: "Verified listings are paid, {checked}, labeled and shown first." */
    checked: 'license-checked',
  },

  regions: US_STATES as Record<string, { name: string; code?: string }>,
  attributes: agentAttributes,
  taxonomies,
  bestFor,

  /** Plan bullets for Basic on /listing-plans/ (niche words for the engine's copy). */
  basicFacts: 'Specialties, and whether the agent works with buyers, sellers or both',

  /** 3–5 short facts on listing cards. */
  cardFacts(l: ListingData): string[] {
    const out: string[] = [];
    const s = (l.attributes.specialties as string[] | undefined) ?? [];
    if (s.length) out.push(s.slice(0, 3).map((k) => specialties[k]).join(', '));
    if (alc(l)) out.push('Accredited Land Consultant');
    const b = l.attributes.worksWithBuyers === true, se = l.attributes.worksWithSellers === true;
    if (b && se) out.push('Buyers and sellers');
    else if (b) out.push('Works with buyers');
    else if (se) out.push('Works with sellers');
    return out.slice(0, 5);
  },

  /** FAQs built only from the listing's own data. */
  listingFaqs(l: ListingData): Faq[] {
    const faqs: Faq[] = [];
    const s = (l.attributes.specialties as string[] | undefined) ?? [];
    if (s.length) faqs.push({ q: `What kind of land does ${l.name} work with?`, a: `${l.name} lists these specialties: ${s.map((k) => specialties[k].toLowerCase()).join(', ')}.` });
    if (typeof l.attributes.worksWithBuyers === 'boolean' || typeof l.attributes.worksWithSellers === 'boolean') {
      const b = l.attributes.worksWithBuyers === true, se = l.attributes.worksWithSellers === true;
      faqs.push({ q: `Does ${l.name} work with buyers or sellers?`, a: b && se ? `Both. ${l.name} lists work with land buyers and sellers.` : b ? `${l.name} lists work with buyers.` : se ? `${l.name} lists work with sellers.` : `${l.name} has not said.` });
    }
    if (alc(l)) faqs.push({ q: `Is ${l.name} an Accredited Land Consultant?`, a: `${l.name} lists the Accredited Land Consultant (ALC) designation, awarded by the REALTORS® Land Institute. You can confirm it in the institute’s “Find a Land Consultant” search.` });
    return faqs;
  },

  /** City-page FAQs, built from the listed agents only. */
  cityFaqs(place: string, ls: ListingData[]): Faq[] {
    const names = (f: (l: ListingData) => boolean) => ls.filter(f).map((l) => l.name);
    const farm = names((l) => has(l, 'specialties', 'farms-ranches'));
    const hunt = names((l) => has(l, 'specialties', 'hunting-recreational'));
    return [
      { q: `How many land agents are listed in ${place}?`, a: `${ls.length} land ${ls.length === 1 ? 'agent is' : 'agents are'} listed in ${place}.` },
      { q: `Which land agents in ${place} sell farms and ranches?`, a: farm.length ? `${farm.join(', ')} list farms and ranches.` : 'None of the listed agents say so yet.' },
      { q: `Which land agents in ${place} sell hunting land?`, a: hunt.length ? `${hunt.join(', ')} list hunting and recreational land.` : 'None of the listed agents say so yet.' },
    ];
  },

  titles: {
    home: 'Rural Land for Sale by Owner & Land Agents in the US | RuralLandListings',
    homeDescription: 'Rural land, farms, ranches and hunting land for sale by owners and agents, by state and county. Sell your land for $49 for 30 days.',
    homeH1: 'Rural land for sale',
    region: (name: string, n: number) => `Land Agents in ${name}: ${n} Rural Land Brokers by City | RuralLandListings`,
    regionDescription: (name: string, n: number, cities: number) => `${n} land agents and brokers in ${cities} ${cities === 1 ? 'city' : 'cities'} across ${name}. Specialties, license-checked Verified agents and contact details.`,
    city: (city: string, code: string) => `Land Agents in ${city}, ${code}: Farm, Ranch & Hunting Land Brokers | RuralLandListings`,
    cityDescription: (city: string, code: string, n: number) => `${n} land agents in ${city}, ${code}. Compare specialties, farm and ranch or hunting land, and who works with buyers and sellers.`,
    cityH1: (city: string, code: string) => `Land agents in ${city}, ${code}`,
    listing: (name: string, city: string, code: string) => `${name}, ${city} ${code}: Land Agent Contact & Specialties`,
    listingDescription: (name: string, city: string, code: string, facts: string[]) => `${name} is a land agent in ${city}, ${code}.${facts.length ? ' ' + facts.join(' · ') + '.' : ''} Phone, website and specialties.`,
  },

  homeFaqs: [
    { q: 'How much does it cost to list land for sale?', a: 'A land listing costs $49 and runs for 30 days. You write it, we review it before it goes live, and it comes down after 30 days unless you renew.' },
    { q: 'Do you inspect the land or check title?', a: 'No. Land listings are ads written by the seller. Before you buy, ask for a survey, a title search and proof of legal access, and check zoning and flood maps with the county.' },
    { q: 'What should I ask before buying rural land?', a: 'Common questions: Is there legal, year-round road access? Are power, a well or septic possible, and has a perc test been done? Is it surveyed? What zoning, easements or deed restrictions apply? Are mineral, water and timber rights included? Is it in a flood zone, and what are the annual taxes?' },
    { q: 'What does Verified mean for a land agent?', a: 'Verified agent listings are paid. We check the agent’s real estate license with the state real estate commission’s public license lookup and confirm the details with the agent, then show the listing first. It is never a rating.' },
  ] as Faq[],

  // ---- Classifieds: land for sale ----
  classifieds: {
    hub: 'land-for-sale',
    entity: { one: 'land listing', many: 'land listings', One: 'Land listing', Many: 'Land listings' },
    /** The place level under the region (folder name holds the slug, the listing file holds the display name). */
    placeNoun: 'county',
    days: 30,
    schemaType: 'RealEstateListing',
    attributes: landAttributes,
    categories: landCategories,

    acresText,
    money,
    priceText: (l: LandData) => (l.price ? money(l.price) : 'Price on request'),
    perAcreText: (l: LandData) => (perAcre(l) ? `${money(perAcre(l) as number)} per acre` : undefined),

    cardFacts(l: LandData): string[] {
      const out = [acresText(l.acres)];
      const pa = perAcre(l);
      if (pa) out.push(`${money(pa)} per acre`);
      const t = types(l);
      if (t.length) out.push(t.slice(0, 2).join(', '));
      if (l.attributes.ownerFinancing === true) out.push('Owner financing');
      return out.slice(0, 4);
    },

    listingFaqs(l: LandData, place: string): Faq[] {
      const faqs: Faq[] = [];
      faqs.push({ q: `How much is this land?`, a: l.price ? `The seller asks ${money(l.price)} for ${acresText(l.acres)}${perAcre(l) ? `, about ${money(perAcre(l) as number)} per acre` : ''}.` : `The seller has not published a price. Contact them for it.` });
      if (typeof l.attributes.ownerFinancing === 'boolean') faqs.push({ q: 'Is owner financing available?', a: l.attributes.ownerFinancing ? 'Yes, the seller says owner financing is available. Ask for the down payment, rate and term in writing.' : 'The seller says no owner financing.' });
      if (typeof l.attributes.publicRoadAccess === 'boolean') faqs.push({ q: 'Does the land have road access?', a: l.attributes.publicRoadAccess ? 'The seller says it has public road access. Ask for the deed or survey that shows it.' : 'The seller says it has no public road frontage. Ask how legal access works, for example a recorded easement.' });
      faqs.push({ q: `Where is it?`, a: `In ${place}${l.location.nearestTown ? `, near ${l.location.nearestTown}` : ''}. The map link uses the seller’s approximate location, not the boundary.` });
      return faqs;
    },

    countyFaqs(place: string, ls: LandData[]): Faq[] {
      const priced = ls.filter((l) => l.price && l.acres);
      const fin = ls.filter((l) => l.attributes.ownerFinancing === true);
      const faqs: Faq[] = [{ q: `How much land is for sale in ${place}?`, a: `${ls.length} ${ls.length === 1 ? 'listing covers' : 'listings cover'} ${acresText(ls.reduce((s, l) => s + l.acres, 0))} in ${place} right now.` }];
      if (priced.length) {
        const pa = priced.map((l) => (l.price as number) / l.acres).sort((a, b) => a - b);
        faqs.push({ q: `What does land cost per acre in ${place}?`, a: `Asking prices on this site run from ${money(Math.round(pa[0]))} to ${money(Math.round(pa[pa.length - 1]))} per acre across ${priced.length} priced ${priced.length === 1 ? 'listing' : 'listings'}. These are sellers’ asking prices, not sales.` });
      }
      faqs.push({ q: `Is there owner financed land in ${place}?`, a: fin.length ? `${fin.length} ${fin.length === 1 ? 'listing offers' : 'listings offer'} owner financing: ${fin.map((l) => l.title).join(', ')}.` : 'None of the current listings offer owner financing.' });
      return faqs;
    },

    titles: {
      hub: 'Rural Land for Sale by State | RuralLandListings',
      hubDescription: (n: number) => `${n} rural land listings for sale by owners and agents, grouped by state and county. Farms, ranches, hunting land and homesites.`,
      region: (name: string, n: number) => `Land for Sale in ${name}: ${n} Rural Land Listings by County | RuralLandListings`,
      regionDescription: (name: string, n: number, counties: number) => `${n} rural land ${n === 1 ? 'listing' : 'listings'} for sale in ${counties} ${counties === 1 ? 'county' : 'counties'} across ${name}. Acreage, asking price, price per acre and owner financing.`,
      regionH1: (name: string) => `Land for sale in ${name}`,
      county: (county: string, code: string) => `Land for Sale in ${county}, ${code}: Acreage, Farms & Hunting Land | RuralLandListings`,
      countyDescription: (county: string, code: string, n: number) => `${n} rural land ${n === 1 ? 'listing' : 'listings'} for sale in ${county}, ${code}. Acres, asking price, price per acre, access and utilities.`,
      countyH1: (county: string, code: string) => `Land for sale in ${county}, ${code}`,
      listing: (title: string, county: string, code: string) => `${title}, ${county} ${code} | Land for Sale`,
      listingDescription: (title: string, county: string, code: string, facts: string[]) => `${title} in ${county}, ${code}: ${facts.join(' · ')}. Contact the seller directly.`,
      category: (title: string) => `${title} in the US by State and County | RuralLandListings`,
      categoryDescription: (noun: string, n: number) => `${n} listings of ${noun} for sale by owners and agents, grouped by state and county.`,
    },
  },
};

export type Site = typeof site;
