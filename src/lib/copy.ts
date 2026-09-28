// Tier copy built from site.config.ts. This is the only place Verified wording is written.
import { PLACEHOLDERS, site } from '../../site.config';

const e = site.entity;
export const price = PLACEHOLDERS.verifiedPrice;
export const payLink = PLACEHOLDERS.verifiedPaymentLink;
export const payIsMailto = payLink.startsWith('mailto:');
export const payLabel = payIsMailto ? 'Email us to pay' : 'Pay now';
export const payEmail = payIsMailto ? payLink.slice('mailto:'.length).split('?')[0] : '';

/** Payment link with the business name as a reference, where the provider supports it. */
export function payLinkFor(name: string): string {
  if (payIsMailto) return `${payLink}?subject=${encodeURIComponent(`Verified listing: ${name}`)}`;
  try {
    const u = new URL(payLink);
    // Stripe Payment Links accept client_reference_id (letters, digits, - and _ only).
    if (u.hostname.endsWith('stripe.com')) u.searchParams.set('client_reference_id', name.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 200));
    return u.toString();
  } catch {
    return payLink;
  }
}

export const credentialCheck = `we check the ${site.credential.name} with ${site.credential.source}, and confirm the details with the owner`;

export const disclosure = 'Verified listings are paid, checked and shown first.';
export const disclosureLinkText = 'Listing plans';

export const footerLine = `${site.name} is an independent directory. Basic listings are free. Verified listings are paid, ${site.credential.checked}, labeled and shown first. No ratings, reviews or referral fees.`;

export const plansIntro = `Every ${e.one} can have a free Basic listing. Verified is paid: ${credentialCheck}, then label the listing Verified and show it first in its city and category lists. Verified is never a rating, and payment never changes the facts we publish.`;

export const basicBullets = [
  `Core facts: address, phone, website, hours`,
  `Styles, services, walk-in policy and shop minimum`,
  `Listed on its city, ${site.regionNoun} and category pages`,
  `Update it any time with the form`,
];

export const verifiedBullets = [
  'Everything in Basic',
  `${site.credential.name[0].toUpperCase()}${site.credential.name.slice(1)} check plus owner confirmation`,
  'The Verified label everywhere the listing appears',
  'Shown first, above Basic listings',
  `Your own description and booking link, rechecked at each renewal`,
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
