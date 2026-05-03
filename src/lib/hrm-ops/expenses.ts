/**
 * Expenses — receipt OCR stub, mileage, and approval flows.
 */

import type { Expense, Receipt, ID } from './types';

export interface OcrProvider {
  /** Extract structured fields from a receipt image / PDF URL. */
  parse(url: string): Promise<NonNullable<Receipt['ocr']>>;
}

/**
 * Stub OCR — always returns low-confidence empty fields. Replace at runtime
 * with a real provider (AWS Textract, Google Document AI, etc.).
 */
export const stubOcr: OcrProvider = {
  async parse(url) {
    void url;
    return { confidence: 0, raw: '' };
  },
};

export async function attachReceipt(
  expense: Expense,
  receipt: Receipt,
  ocr: OcrProvider = stubOcr,
): Promise<{ expense: Expense; receipt: Receipt }> {
  const parsed = await ocr.parse(receipt.url);
  const enriched: Receipt = {
    ...receipt,
    ocr: { ...receipt.ocr, ...parsed },
  };
  // If OCR is confident, use it to backfill expense fields.
  const useOcr = (parsed.confidence ?? 0) >= 0.8;
  return {
    expense: {
      ...expense,
      receiptId: enriched.id,
      amount: useOcr && parsed.amount ? parsed.amount : expense.amount,
      currency: useOcr && parsed.currency ? parsed.currency : expense.currency,
      merchant: useOcr && parsed.merchant ? parsed.merchant : expense.merchant,
      date: useOcr && parsed.date ? parsed.date : expense.date,
    },
    receipt: enriched,
  };
}

/* ── Mileage ────────────────────────────────────────────────────── */

/** IRS standard mileage rate (USD/mile) for business use, 2025. */
export const MILEAGE_RATE_USD_PER_MILE = 0.7;
/** HMRC AMAP first 10k miles (GBP/mile) for cars/vans. */
export const MILEAGE_RATE_GBP_PER_MILE = 0.45;
/** India FBP cap (INR/km) for fuel reimbursement. */
export const MILEAGE_RATE_INR_PER_KM = 12;

export function calculateMileage(
  miles: number,
  country: 'US' | 'UK' | 'IN' | 'OTHER' = 'US',
): { amount: number; currency: string; rate: number } {
  switch (country) {
    case 'UK':
      return { amount: round2(miles * MILEAGE_RATE_GBP_PER_MILE), currency: 'GBP', rate: MILEAGE_RATE_GBP_PER_MILE };
    case 'IN':
      return { amount: round2(miles * MILEAGE_RATE_INR_PER_KM), currency: 'INR', rate: MILEAGE_RATE_INR_PER_KM };
    case 'US':
    default:
      return { amount: round2(miles * MILEAGE_RATE_USD_PER_MILE), currency: 'USD', rate: MILEAGE_RATE_USD_PER_MILE };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ── Approval flow ──────────────────────────────────────────────── */

export interface ApprovalRule {
  /** All amounts in tenant base currency */
  thresholdAmount: number;
  approverRole: 'manager' | 'director' | 'cfo' | 'auto';
}

export const DEFAULT_RULES: ApprovalRule[] = [
  { thresholdAmount: 100, approverRole: 'auto' },
  { thresholdAmount: 1_000, approverRole: 'manager' },
  { thresholdAmount: 5_000, approverRole: 'director' },
  { thresholdAmount: Infinity, approverRole: 'cfo' },
];

export function pickApprover(amount: number, rules: ApprovalRule[] = DEFAULT_RULES): ApprovalRule['approverRole'] {
  for (const r of rules) {
    if (amount <= r.thresholdAmount) return r.approverRole;
  }
  return rules[rules.length - 1]?.approverRole ?? 'cfo';
}

export function submit(expense: Expense): Expense {
  return { ...expense, status: 'submitted' };
}

export function approve(expense: Expense, approverId: ID): Expense {
  return { ...expense, status: 'approved', approverId };
}

export function reject(expense: Expense, approverId: ID): Expense {
  return { ...expense, status: 'rejected', approverId };
}

export function reimburse(expense: Expense): Expense {
  return { ...expense, status: 'reimbursed' };
}
