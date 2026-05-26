import 'server-only';

/**
 * SabMeet — Dial-ins client. Wraps `/v1/sabmeet/dialins`.
 */
import { makeCrmClient, type CrmListParams } from './crm-base';

export type SabmeetDialInPinPolicy = 'required' | 'optional' | 'none';

export interface SabmeetDialInDoc {
  _id: string;
  userId: string;
  regionCode: string;
  label: string;
  phoneNumber: string;
  pinPolicy: SabmeetDialInPinPolicy;
  tollFree?: boolean;
  isDefault?: boolean;
  language?: string;
  active?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SabmeetDialInCreateInput {
  regionCode: string;
  label: string;
  phoneNumber: string;
  pinPolicy?: SabmeetDialInPinPolicy;
  tollFree?: boolean;
  isDefault?: boolean;
  language?: string;
}

export interface SabmeetDialInListParams extends CrmListParams {
  regionCode?: string;
  activeOnly?: boolean;
}

export const sabmeetDialinsClient = makeCrmClient<SabmeetDialInDoc, SabmeetDialInCreateInput>(
  '/v1/sabmeet/dialins',
);
