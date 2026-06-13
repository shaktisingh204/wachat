/**
 * SabCRM Commerce — doc-surface action types + status vocab.
 *
 * Lives beside `sabcrm-commerce-docs.actions.ts` because `'use server'`
 * modules may only export async functions (mirrors the
 * `sabcrm-supply-docs.actions.types.ts` convention).
 *
 * Crate-typed enums (sessions, transactions, holds, storefronts,
 * orders) come straight off the rust-client wire types; the constants
 * here cover the FREE-FORM wires the shared actions write (rollout
 * spec §4 — UI vocab is the only guard).
 */

/* ─── POS refunds (`crm-pos` UpdateRefundInput is free-form) ─────── */

/** UI vocabulary (spec WI-20): pending → completed; failed exception. */
export type SabcrmPosRefundUiStatus = 'pending' | 'completed' | 'failed';

export const SABCRM_POS_REFUND_FLOW: readonly SabcrmPosRefundUiStatus[] = [
  'pending',
  'completed',
];

/** Allowed `from → to[]` transitions for the refund status PATCH. */
export const SABCRM_POS_REFUND_TRANSITIONS: Record<
  SabcrmPosRefundUiStatus,
  SabcrmPosRefundUiStatus[]
> = {
  pending: ['completed', 'failed'],
  completed: [],
  failed: ['pending'],
};

/* ─── Coupons (`crm-coupons`, free-form status) ──────────────────── */

/** UI vocabulary (spec WI-15). */
export type SabcrmCouponUiStatus = 'active' | 'inactive' | 'archived';

/* ─── Gift cards (`crm-gift-cards`, free-form status) ────────────── */

/** UI vocabulary (spec WI-16). */
export type SabcrmGiftCardUiStatus =
  | 'active'
  | 'redeemed'
  | 'expired'
  | 'archived';
