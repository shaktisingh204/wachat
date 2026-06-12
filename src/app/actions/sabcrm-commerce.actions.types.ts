/**
 * Form-input shapes for the SabCRM Commerce server actions
 * (`sabcrm-commerce.actions.ts`). Kept in a separate non-'use server'
 * module so the types can be imported by client components without
 * dragging the server-action module graph in.
 *
 * All fields arrive as strings from the generic commerce dialog
 * (`commerce-client.tsx`) and are coerced/validated inside the actions.
 */

/** "Open POS session" dialog payload. */
export interface SabcrmCommercePosSessionFormInput {
  terminalId: string;
  openingCash?: string | number;
  notes?: string;
}

/** "New storefront" dialog payload. */
export interface SabcrmCommerceStorefrontFormInput {
  name: string;
  slug: string;
  currency?: string;
  domain?: string;
}

/** "New coupon" dialog payload. */
export interface SabcrmCommerceCouponFormInput {
  code: string;
  type?: string;
  value?: string | number;
  minCart?: string | number;
  maxUses?: string | number;
  validTo?: string;
  notes?: string;
}

/** "New gift card" dialog payload. */
export interface SabcrmCommerceGiftCardFormInput {
  code?: string;
  value?: string | number;
  issuedTo?: string;
  issuedToEmail?: string;
  expiryDate?: string;
  notes?: string;
}

/** "New shipping zone" dialog payload (single starter method). */
export interface SabcrmCommerceShippingZoneFormInput {
  storefrontId: string;
  name: string;
  /** Comma-separated ISO-2 country codes ("IN, AE"). */
  countries?: string;
  methodKind?: string;
  methodRate?: string | number;
}
