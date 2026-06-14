import 'server-only';

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import type { SabpayKyc } from './kyc-shared';

/**
 * SabPay merchant onboarding / KYC.
 *
 * Every user must complete onboarding (business details + bank account + KYC
 * documents) before they can use SabPay — like a real payment gateway. Stored
 * in `sabpay_kyc` (one doc per userId), separate from the Rust-owned
 * `sabpay_merchants` doc so the gate is pure Next.js (no Rust change). Document
 * uploads go through SabFiles (node id + url), never a URL paste.
 *
 * Client-safe types + the BUSINESS_TYPES constant live in ./kyc-shared (no
 * `server-only`/mongodb) and are re-exported here so server-side importers can
 * keep importing from `@/lib/sabpay/kyc` unchanged. Client components must
 * import those from `@/lib/sabpay/kyc-shared` directly.
 */

export { BUSINESS_TYPES } from './kyc-shared';
export type { SabpayKycStatus, SabpayKycFileRef, SabpayKyc } from './kyc-shared';

/** Read the KYC doc for a user (raw, minus `_id`/`userId`). */
export async function getKycByUser(userId: string): Promise<SabpayKyc | null> {
  if (!userId || !ObjectId.isValid(userId)) return null;
  const { db } = await connectToDatabase();
  const doc = await db
    .collection('sabpay_kyc')
    .findOne({ userId: new ObjectId(userId) }, { projection: { _id: 0, userId: 0 } });
  return (doc as SabpayKyc | null) ?? null;
}

/** Whether the merchant has finished onboarding (may use the dashboard). */
export function isKycComplete(kyc: SabpayKyc | null): boolean {
  return kyc?.status === 'verified';
}

/** Fields/documents required before a KYC submission is accepted. */
export function missingKycRequirements(kyc: SabpayKyc | null): string[] {
  const missing: string[] = [];
  if (!kyc) return ['everything'];
  if (!kyc.legalName?.trim()) missing.push('legal business name');
  if (!kyc.businessType?.trim()) missing.push('business type');
  if (!kyc.contactEmail?.trim()) missing.push('contact email');
  if (!kyc.address1?.trim()) missing.push('address');
  if (!kyc.country?.trim()) missing.push('country');
  if (!kyc.bankAccountHolder?.trim()) missing.push('bank account holder');
  if (!kyc.bankAccountNumber?.trim()) missing.push('bank account number');
  if (!kyc.bankIfsc?.trim()) missing.push('bank IFSC / routing');
  if (!kyc.docIdentity?.id) missing.push('identity document');
  if (!kyc.docBankProof?.id) missing.push('bank proof');
  return missing;
}
