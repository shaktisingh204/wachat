/**
 * Types extracted from public-proposal.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type PublicProposalDetail = {
  ok: true;
  proposal: {
    _id: string;
    proposalNumber: string;
    title: string;
    proposalDate: string | null;
    validTill: string | null;
    currency: string;
    status: string;
    description: string;
    note?: string;
    subtotal?: number;
    tax?: number;
    total: number;
    signed: boolean;
    signature: {
      signedByName: string;
      signedAt: string;
      signatureDataUrl: string;
    } | null;
  };
  company: PublicProposalDetailCompany;
  deal: PublicProposalDetailRecipient;
  items: PublicProposalDetailItem[];
};

export type PublicProposalDetailResult = PublicProposalDetail | { ok: false; error: string };
