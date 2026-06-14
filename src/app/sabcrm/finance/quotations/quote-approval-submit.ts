'use client';

/**
 * SabCRM Finance — discount-approval-on-submit helper (quotation form).
 *
 * After a quotation is saved, this fires the gated `requestDiscountApprovalTw`
 * action for the saved quote. The action RE-PRICES server-side and only
 * persists a request when the blended discount actually breaches the project
 * threshold (`request === null` ⇒ the rep may proceed without approval), so
 * this helper never has to decide the threshold itself — it just relays the
 * verdict to the user via a toast.
 *
 * BEST-EFFORT / GRACEFUL DEGRADATION: a failure (no permission, network, no
 * price book) is swallowed silently. A discount-approval request never blocks
 * the underlying save — the quotation is already persisted by the time this
 * runs; this only raises the optional approval + informs the rep.
 *
 * Returns whether an approval request was actually raised (for callers that
 * want to react), but most callers can fire-and-forget it.
 */

import { toast } from '@/components/sabcrm/20ui';
import { requestDiscountApprovalTw } from '@/app/actions/sabcrm-pricing.actions';
import type { DocLineDraft } from '../_components/doc-surface';
import { docLinesToQuoteLines } from './quote-pricing-map';

export interface MaybeRequestApprovalArgs {
  /** The form's draft lines (blank rows are dropped before pricing). */
  lines: DocLineDraft[];
  /** Quotation number, stored on the request for the audit trail. */
  quoteRef?: string;
  /** Saved quotation record id, so the approval links back to the deal/quote. */
  targetRecordId?: string;
  /** Reason copy shown on the request (optional). */
  reason?: string;
}

/**
 * Raise a discount-approval request for a just-saved quote when its discount
 * breaches the threshold. Resolves `true` iff a request was created. Never
 * throws — all failures degrade to `false`.
 */
export async function maybeRequestDiscountApproval(
  args: MaybeRequestApprovalArgs,
): Promise<boolean> {
  const lines = docLinesToQuoteLines(args.lines);
  if (lines.length === 0) return false;
  try {
    const res = await requestDiscountApprovalTw({
      quote: { lines },
      quoteRef: args.quoteRef,
      targetObject: 'quotations',
      targetRecordId: args.targetRecordId,
      reason: args.reason,
    });
    if (!res.ok) return false;
    if (res.data.request) {
      toast.info(
        `Discount approval requested (${res.data.approval.effectiveDiscountPct}% exceeds the ${res.data.approval.thresholdPct}% threshold).`,
      );
      return true;
    }
    return false;
  } catch {
    // Best-effort — a downed approvals path must not disturb the save flow.
    return false;
  }
}
