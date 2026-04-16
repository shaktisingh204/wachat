/**
 * SabFlow input formatters — pure helpers for presenting user-entered
 * values in a consistent, locale-aware way.  Kept separate from
 * validators so callers can pick and choose.
 */

/* ── phone ──────────────────────────────────────────────────────────── */

type LibPhoneNumberFormatModule = {
  parsePhoneNumberFromString?: (
    value: string,
    country?: string,
  ) => { formatInternational?: () => string } | undefined;
};

let libCache: LibPhoneNumberFormatModule | null | undefined;

async function loadLibPhoneNumber(): Promise<LibPhoneNumberFormatModule | null> {
  if (libCache !== undefined) return libCache;
  try {
    const moduleName = 'libphonenumber' + '-js';
    const mod = (await import(
      /* webpackIgnore: true */ /* @vite-ignore */ moduleName
    )) as LibPhoneNumberFormatModule;
    libCache = mod;
    return mod;
  } catch {
    libCache = null;
    return null;
  }
}

/**
 * Best-effort phone number formatter.  If libphonenumber-js is
 * available and parses the value, returns the international format
 * ("+1 555 123 4567").  Otherwise returns the input mostly unchanged,
 * trimming and collapsing whitespace for consistency.
 *
 * Note: returns a Promise because libphonenumber-js is loaded on
 * demand.  For sync use, fall back to `formatPhoneSync`.
 */
export async function formatPhone(
  value: string,
  country?: string,
): Promise<string> {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const lib = await loadLibPhoneNumber();
  if (lib?.parsePhoneNumberFromString) {
    const parsed = lib.parsePhoneNumberFromString(raw, country);
    const formatted = parsed?.formatInternational?.();
    if (formatted) return formatted;
  }
  return formatPhoneSync(raw, country);
}

/**
 * Synchronous phone formatter — performs minimal cleanup:
 *   - collapses whitespace
 *   - prepends "+" if the value looks like an international number
 *     starting with a country code but missing the prefix
 */
export function formatPhoneSync(value: string, _country?: string): string {
  const raw = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  // Friendly US formatting when it looks like 10 digits
  const digits = raw.replace(/\D/g, '');
  if (/^\+?1\d{10}$/.test(digits) && digits.length === 11) {
    const d = digits;
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (digits.length === 10 && !raw.startsWith('+')) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

/* ── date ───────────────────────────────────────────────────────────── */

export function formatDate(
  value: string,
  format: 'short' | 'long' | 'iso',
): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  if (format === 'iso') {
    return date.toISOString();
  }

  const options: Intl.DateTimeFormatOptions =
    format === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' };

  try {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/* ── number ─────────────────────────────────────────────────────────── */

export function formatNumber(
  value: number,
  options?: { decimals?: number; locale?: string; currency?: string },
): string {
  if (!Number.isFinite(value)) return '';

  const locale = options?.locale;
  const intlOptions: Intl.NumberFormatOptions = {};

  if (options?.currency) {
    intlOptions.style = 'currency';
    intlOptions.currency = options.currency;
  }

  if (options?.decimals !== undefined) {
    intlOptions.minimumFractionDigits = options.decimals;
    intlOptions.maximumFractionDigits = options.decimals;
  }

  try {
    return new Intl.NumberFormat(locale, intlOptions).format(value);
  } catch {
    return String(value);
  }
}
