/**
 * SabPay KYC — client-safe shared types & constants.
 *
 * Split out of ./kyc (which is `server-only` and pulls in the mongodb driver) so
 * client components — e.g. the onboarding wizard — can import BUSINESS_TYPES and
 * the SabpayKyc types without dragging the DB layer into the browser bundle.
 * The server module (./kyc) re-exports everything here, so existing server-side
 * importers keep working unchanged.
 */

export type SabpayKycStatus = 'pending' | 'under_review' | 'verified' | 'rejected';

export interface SabpayKycFileRef {
  id: string;
  url: string;
  name?: string;
}

export interface SabpayKyc {
  status: SabpayKycStatus;
  // Business
  legalName?: string;
  businessType?: string;
  registrationNumber?: string;
  taxId?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  // Settlement bank account
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  // KYC documents (SabFiles)
  docIdentity?: SabpayKycFileRef;
  docBusinessProof?: SabpayKycFileRef;
  docAddressProof?: SabpayKycFileRef;
  docBankProof?: SabpayKycFileRef;
  // Meta
  rejectionReason?: string;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const BUSINESS_TYPES = [
  'individual',
  'proprietorship',
  'partnership',
  'private_limited',
  'llp',
  'trust_society',
  'other',
] as const;
