/**
 * Types extracted from public-contract.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type PublicContractDetail = {
  ok: true;
  contract: {
    _id: string;
    contractName: string;
    contractNumber?: string;
    contractDate: string | null;
    startDate: string | null;
    endDate: string | null;
    amount?: number;
    currency: string;
    partyFirst?: string;
    partySecond?: string;
    contractDetail: string;
    signed: boolean;
  };
  company: PublicContractDetailCompany;
  client: PublicContractDetailClient;
  signature: {
    company: PublicContractDetailSignature;
    client: PublicContractDetailSignature;
  };
};

export type PublicContractDetailResult = PublicContractDetail | { ok: false; error: string };
