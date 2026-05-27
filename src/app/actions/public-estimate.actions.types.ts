/**
 * Types extracted from public-estimate.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type PublicEstimateDetail = {
  ok: true;
  estimate: {
    _id: string;
    estimateNumber: string;
    estimateDate: string | null;
    validTill: string | null;
    currency: string;
    status: string;
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
    notes?: string;
    termsAndConditions?: string[];
    signed: boolean;
    signature: {
      signedByName: string;
      signedAt: string;
      signatureDataUrl: string;
    } | null;
  };
  company: PublicEstimateDetailCompany;
  client: PublicEstimateDetailClient;
  items: PublicEstimateDetailItem[];
};

export type PublicEstimateDetailResult = PublicEstimateDetail | { ok: false; error: string };
