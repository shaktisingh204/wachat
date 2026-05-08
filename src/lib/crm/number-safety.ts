const DEFAULT_MAX_ABS_MONEY = 100_000_000_000;

export function coerceFiniteMoney(
  value: unknown,
  maxAbs = DEFAULT_MAX_ABS_MONEY,
): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : 0;

  if (!Number.isFinite(numeric)) return 0;

  const absLimit = Math.abs(maxAbs);
  if (Math.abs(numeric) > absLimit) {
    return Math.sign(numeric) * absLimit;
  }

  return numeric;
}

export function formatFiniteCurrency(
  value: unknown,
  currency = 'INR',
  locale = 'en-IN',
): string {
  const amount = coerceFiniteMoney(value);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
