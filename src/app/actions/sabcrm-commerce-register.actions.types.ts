/**
 * SabCRM Commerce — POS register action types (spec WI-22 §5.2).
 *
 * The register checkout/hold/recall payloads. Line items use the crate
 * field names (`quantity`, not the legacy `qty`); `sku` is NOT
 * persisted by the crate (kept client-side for display only). Totals
 * are computed server-side — never sent (`PosLineItemInput.total` stays
 * optional and the client omits it).
 */

import type {
  CrmPosPaymentMethod,
  CrmPosPaymentSplit,
} from '@/lib/rust-client/crm-pos';

/** One register cart line on the wire (crate `PosLineItemInput`). */
export interface SabcrmRegisterLineInput {
  itemId?: string | null;
  name: string;
  quantity: number;
  rate: number;
  taxRate?: number;
}

/** Checkout payload — `customerId` (walk-in = undefined), no totals. */
export interface SabcrmRegisterCheckoutInput {
  sessionId: string;
  customerId?: string;
  lineItems: SabcrmRegisterLineInput[];
  paymentMethod: CrmPosPaymentMethod;
  paymentSplits?: CrmPosPaymentSplit[];
}

/** Hold payload — park the cart for later recall. */
export interface SabcrmRegisterHoldInput {
  sessionId: string;
  customerId?: string;
  lineItems: SabcrmRegisterLineInput[];
  holdReason?: string;
}

/** Recall payload — compose a checkout from the parked hold. */
export interface SabcrmRegisterRecallInput {
  holdId: string;
  paymentMethod: CrmPosPaymentMethod;
  paymentSplits?: CrmPosPaymentSplit[];
}
