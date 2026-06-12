/**
 * SabSMS — tiny E.164 prefix → ISO country resolver.
 *
 * Used only to pick a credit rate row (`credits/rates.ts`) for live UI
 * estimates — the engine resolves the real destination at send time.
 * Longest-prefix match over a deliberately small table; unknown
 * prefixes return '' which falls through to the default rate.
 *
 * Pure module — safe for client and server.
 */

/** Longest-prefix-first map of dialing codes to ISO 3166-1 alpha-2. */
const PREFIX_TO_COUNTRY: Array<[string, string]> = [
  ['880', 'BD'],
  ['971', 'AE'],
  ['977', 'NP'],
  ['234', 'NG'],
  ['91', 'IN'],
  ['44', 'GB'],
  ['49', 'DE'],
  ['33', 'FR'],
  ['61', 'AU'],
  ['65', 'SG'],
  ['81', 'JP'],
  ['86', 'CN'],
  ['55', 'BR'],
  ['92', 'PK'],
  ['94', 'LK'],
  ['27', 'ZA'],
  // NANP — +1 covers US and CA (both bill identically in rates.ts).
  ['1', 'US'],
];

/**
 * Resolve a destination country from an E.164-ish number. Tolerates a
 * missing '+', spaces, and dashes. Returns '' when unknown.
 */
export function countryFromE164(to: string): string {
  const digits = (to ?? '').replace(/[^\d]/g, '');
  if (!digits) return '';
  for (const [prefix, country] of PREFIX_TO_COUNTRY) {
    if (digits.startsWith(prefix)) return country;
  }
  return '';
}
