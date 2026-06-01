// PORT-NOTE: DOLLAR_TO_CREDIT_MULTIPLIER was sourced from ai-billing constants.
// Value is inlined here to avoid a cross-package import that doesn't exist in
// the SabNode tree. Update if the multiplier changes.
const DOLLAR_TO_CREDIT_MULTIPLIER = 100_000; // 1 USD = 100,000 micro-credits (as per twenty-server constant)

// Converts internal micro-credits to dollars.
// Rounds to 2 decimal places (e.g. 7500 → 0.01).
export const toDollars = (internalCredits: number): number =>
  Math.round((internalCredits / DOLLAR_TO_CREDIT_MULTIPLIER) * 100) / 100;
