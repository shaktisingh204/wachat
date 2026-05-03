/**
 * Right-to-left detection.
 *
 * Used by the layout shell to flip `dir="rtl"` on `<html>` and by Tailwind's
 * `rtl:` variant. We accept either a bare base code (`ar`) or a region code
 * (`ar-SA`).
 */

const RTL_BASES = new Set([
    'ar', // Arabic
    'arc', // Aramaic
    'dv', // Divehi
    'fa', // Persian
    'ha', // Hausa (Ajami)
    'he', // Hebrew
    'khw', // Khowar
    'ks', // Kashmiri
    'ku', // Kurdish (Sorani)
    'ps', // Pashto
    'ur', // Urdu
    'yi', // Yiddish
]);

/** Returns `true` if the locale uses a right-to-left script. */
export function isRtl(locale: string | null | undefined): boolean {
    if (!locale) return false;
    const base = locale.toLowerCase().split(/[-_]/)[0];
    return RTL_BASES.has(base);
}

/** Returns `'rtl'` or `'ltr'`. */
export function direction(locale: string | null | undefined): 'rtl' | 'ltr' {
    return isRtl(locale) ? 'rtl' : 'ltr';
}
