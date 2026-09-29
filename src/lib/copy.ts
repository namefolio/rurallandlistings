// Tier copy built from site.config.ts. This is the only place Verified wording is written.
import { PLACEHOLDERS, site } from '../../site.config';

const e = site.entity;
export const price = PLACEHOLDERS.verifiedPrice;
export const payLink = PLACEHOLDERS.verifiedPaymentLink;
export const payIsMailto = payLink.startsWith('mailto:');
export const payLabel = payIsMailto ? 'Email us to pay' : 'Pay now';
export const payEmail = payIsMailto ? payLink.slice('mailto:'.length).split('?')[0] : '';

/** Payment link with the business name as a reference, where the provider supports it. */
export function payLinkFor(name: string, link = payLink, label = 'Verified listing'): string {
  if (link.startsWith('mailto:')) return `${link}?subject=${encodeURIComponent(`${label}: ${name}`)}`;
  try {
    const u = new URL(link);
    // Stripe Payment Links accept client_reference_id (letters, digits, - and _ only).
    if (u.hostname.endsWith('stripe.com')) u.searchParams.set('client_reference_id', name.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 200));
    return u.toString();
  } catch {
    return link;
  }
}

export const credentialCheck = `we check the ${site.credential.name} with ${site.credential.source}, and confirm the details with the owner`;

export const disclosure = 'Verified listings are paid, checked and shown first.';
export const disclosureLinkText = 'Listing plans';

const k = site.classifieds;
export const classifiedPrice = PLACEHOLDERS.classifiedPrice;
export const classifiedPayLink = PLACEHOLDERS.classifiedPaymentLink;
export const classifiedPayIsMailto = classifiedPayLink.startsWith('mailto:');
export const classifiedPayLabel = classifiedPayIsMailto ? 'Email us to pay' : 'Pay now';
export const classifiedPayEmail = classifiedPayIsMailto ? classifiedPayLink.slice('mailto:'.length).split('?')[0] : '';
export const classifiedTerm = `${classifiedPrice} for ${k.days} days`;
export const classifiedPayFor = (title: string) => payLinkFor(title, classifiedPayLink, `${k.entity.One}`);

/** Shown on classified pages and lists: what a paid ad is, and what we don't check. */
export const adNotice = `Listings are written by sellers. We review each one before it goes live, but we do not independently verify property information.`;
export const buyerAdvice = 'Buyers should independently verify property information and conduct appropriate due diligence before purchasing.';
export const marketplaceLine = `${site.name} is a marketplace, not a real estate brokerage. We do not act as the buyer’s or seller’s real estate agent.`;

/** What a seller's listing is never checked for (property pages, disclaimer page). */
export const notChecked = ['Title', 'Boundaries', 'Legal access', 'Zoning', 'Utilities', 'Flood status', 'Mineral rights', 'Taxes'];

/** What $49 buys. Never promises leads, sales, traffic or interest. */
export const sellerGets = [
  'A dedicated property page',
  'A photo gallery (up to 25 photos)',
  'Visibility in search and on the map',
  'Placement on your state and county pages',
  'Buyer enquiries straight to you',
  'A review before it goes live',
  'No seller commission',
  'No buyer fee',
];

export const buyerSteps: [string, string][] = [
  ['Search land', 'Filter by location, acreage, price, land type and features, or browse the map.'],
  ['Review property information', 'Each listing shows the seller’s photos, description and a standard set of property details.'],
  ['Contact the seller', 'Call or email the owner or their agent directly. No sign-up, no buyer fee.'],
  ['Do your own due diligence', 'Check title, survey, access, zoning, utilities and flood status before you buy.'],
];
export const sellerSteps: [string, string][] = [
  ['Create your listing', 'Location, acreage, price and the property details buyers ask about.'],
  ['Upload photos and details', 'Up to 25 photos, resized automatically for fast pages.'],
  [`Pay ${classifiedPrice}`, `One flat fee for ${k.days} days. No commission.`],
  ['Your listing is reviewed', 'We check it is complete and appropriate before it goes live.'],
  ['Buyers contact you directly', 'Enquiries come to your phone or email, not through us.'],
];

export const footerLine = `${site.name} is a marketplace, not a real estate brokerage, and does not represent buyers or sellers. Land listings are paid ads (${classifiedTerm}) written by sellers; we review them before they go live but do not independently verify property information. Basic ${e.one} profiles are free; Verified profiles are paid and ${site.credential.checked}. No ratings, reviews or referral fees.`;

/** The agent badge wording. */
export const licenseBadge = 'License Verified';
export const verifiedMeaning = `License Verified means we looked up the agent’s ${site.credential.name} with ${site.credential.source} and confirmed the details with the agent. It is not a rating, review or endorsement.`;

export const sellSteps = sellerSteps.map(([t, d]) => `${t}: ${d}`);

export const sellFaqs = [
  { q: `How much does it cost to list land?`, a: `${classifiedPrice} for ${k.days} days. There is no commission and no fee when it sells.` },
  { q: 'Who can list?', a: `Owners and agents. If you are an agent, you can also add a free Basic ${e.one} listing, or a Verified one for ${price}.` },
  { q: 'What happens after 30 days?', a: `The ad comes down on the next daily rebuild after its end date. Renew it for another ${classifiedPrice} with the form on your listing.` },
  { q: 'Can I add photos?', a: 'Yes. Upload up to 25 photos from your phone or computer; they are resized automatically so your page loads fast. You can also add a YouTube or Vimeo video link and links to a survey or map.' },
  { q: 'Does paying guarantee buyers or a sale?', a: 'No. Your $49 buys 30 days of listing on the site. We cannot promise enquiries, traffic or a sale.' },
  { q: 'Can I edit my listing?', a: 'Yes. Use the link on your listing page to send changes; changes during the 30 days are free.' },
];

export const plansIntro = `Every ${e.one} can have a free Basic listing. Verified is paid: ${credentialCheck}, then label the listing Verified and show it first in its city and category lists. Verified is never a rating, and payment never changes the facts we publish.`;

export const basicBullets = [
  `Core facts: address, phone, website, hours`,
  site.basicFacts,
  `Listed on its city, ${site.regionNoun} and category pages`,
  `Update it any time with the form`,
];

export const verifiedBullets = [
  'Everything in Basic',
  `${site.credential.name[0].toUpperCase()}${site.credential.name.slice(1)} check plus owner confirmation`,
  'The Verified label everywhere the listing appears',
  'Shown first, above Basic listings',
  `Your own description and contact link, rechecked at each renewal`,
];

export const howToSteps = [
  `Send your details with the form and choose “Verified”, or use “Is this your business?” on your listing.`,
  payIsMailto ? `Pay ${price}: email ${payEmail} and we’ll send an invoice.` : `Pay ${price} with the payment link.`,
  `We check the ${site.credential.name} with ${site.credential.source} and confirm the details with you. If the check fails we refund you and the listing stays Basic.`,
  `The listing gets the Verified label and moves above Basic listings. We recheck it at renewal, and it returns to Basic if not renewed.`,
];

export const plansFaqs = [
  { q: 'Is a Basic listing really free?', a: `Yes. We never hide a correct Basic listing because a nearby ${e.one} paid.` },
  { q: 'Does paying change what you publish?', a: 'No. It buys the Verified label, the check and a place above Basic listings. It never buys a rating, a review or changed facts.' },
  { q: 'How are listings ordered?', a: 'Verified first, then Basic. Within each, the most complete listings come first, then A to Z.' },
  { q: 'How much does Verified cost?', a: `${price}.` },
];

export const aboutListings = [
  `Basic listings are free. Their details come from public sources (the ${e.one}’s own website and social pages) or from a submission, and each shows the date it was last updated. Nobody at the ${e.one} has confirmed a Basic listing with us.`,
  `Verified listings are paid. Before we label a listing Verified, ${credentialCheck}. Verified listings are shown first, with a one-line note saying so wherever that happens. The label lapses back to Basic if it is not renewed.`,
];
