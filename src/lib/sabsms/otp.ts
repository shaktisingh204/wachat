/**
 * SabSMS OTP/Verify — pure helpers shared by the /sabsms/otp dashboard
 * (V2.7).
 *
 * The Rust engine (`services/sabsms-engine/src/otp/`) owns the runtime
 * behaviour; these helpers mirror its CLAMPS and validation so the form
 * never persists a config the engine would silently re-clamp, and so
 * manual fraud-block entries match the engine's prefix matching.
 *
 * Pure (no IO) — unit-tested in `__tests__/otp.test.ts`.
 */

/** Per-workspace OTP configuration (`sabsms_otp_configs` document). */
export interface SabsmsOtpConfig {
  /** Numeric code length — engine clamps to 4–8. */
  codeLength: number;
  /** Code lifetime in seconds — engine clamps to 30–3600. */
  ttlSecs: number;
  /** Wrong-code budget per code — engine clamps to 1–20. */
  maxAttempts: number;
  /** Resend budget per code — engine clamps to 0–10. */
  maxResends: number;
  /** Seconds between sends to the same phone — engine clamps to 5–600. */
  resendCooldownSecs: number;
  /** SMS body; `{#code#}` and `{#brand#}` are substituted engine-side. */
  templateBody: string;
  /** Alphanumeric sender ID (msg91/gupshup routes), optional. */
  senderId?: string;
  /** Substituted for `{#brand#}`, optional. */
  brandName?: string;
}

/** Engine defaults (`OtpConfig::default()` in `otp/store.rs`). */
export const SABSMS_OTP_CONFIG_DEFAULTS: SabsmsOtpConfig = {
  codeLength: 6,
  ttlSecs: 300,
  maxAttempts: 5,
  maxResends: 3,
  resendCooldownSecs: 30,
  templateBody: 'Your verification code is {#code#}',
};

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.trunc(raw)
      : typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))
        ? Math.trunc(Number(raw))
        : fallback;
  return Math.min(max, Math.max(min, n));
}

function optTrimmed(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  return s === '' ? undefined : s;
}

/**
 * Normalise raw form/doc input into a valid OTP config, applying the
 * SAME clamps the engine's `OtpConfig::from_doc` uses — what's saved is
 * exactly what runs.
 */
export function clampOtpConfig(raw: Partial<Record<keyof SabsmsOtpConfig, unknown>>): SabsmsOtpConfig {
  const def = SABSMS_OTP_CONFIG_DEFAULTS;
  return {
    codeLength: clampInt(raw.codeLength, def.codeLength, 4, 8),
    ttlSecs: clampInt(raw.ttlSecs, def.ttlSecs, 30, 3600),
    maxAttempts: clampInt(raw.maxAttempts, def.maxAttempts, 1, 20),
    maxResends: clampInt(raw.maxResends, def.maxResends, 0, 10),
    resendCooldownSecs: clampInt(raw.resendCooldownSecs, def.resendCooldownSecs, 5, 600),
    templateBody: optTrimmed(raw.templateBody) ?? def.templateBody,
    senderId: optTrimmed(raw.senderId),
    brandName: optTrimmed(raw.brandName),
  };
}

/**
 * Validate + normalise a manual fraud-block prefix: `+` followed by
 * 1–14 digits (E.164 prefix; engine matches blocklist rows by string
 * prefix against the destination). Returns `null` when invalid.
 *
 * Accepts user-friendly input: surrounding whitespace, a missing `+`
 * (added), and separators (spaces/dashes) inside the digits.
 */
export function normalizeBlockPrefix(raw: string): string | null {
  const trimmed = raw.trim().replace(/^\+/, '').replace(/[\s-]/g, '');
  if (!/^\d{1,14}$/.test(trimmed)) return null;
  return `+${trimmed}`;
}

/** Display string for a conversion rate, e.g. `87.5%` (em dash for no volume). */
export function formatConversionRate(sent: number, converted: number): string {
  if (!Number.isFinite(sent) || sent <= 0) return '—';
  const pct = (Math.min(converted, sent) / sent) * 100;
  return `${pct.toFixed(1)}%`;
}

/**
 * Preview the rendered OTP SMS body the way the engine's
 * `render_template` does: `{#brand#}` substitutes (empty when unset),
 * `{#code#}` substitutes — and a template MISSING the code placeholder
 * gets the code appended so the OTP always reaches the user.
 */
export function previewOtpTemplate(template: string, code: string, brand?: string): string {
  let body = template.replace(/\{#brand#\}/g, brand ?? '');
  if (body.includes('{#code#}')) {
    body = body.replace(/\{#code#\}/g, code);
  } else {
    body = `${body.trimEnd()} ${code}`;
  }
  return body.trim();
}
