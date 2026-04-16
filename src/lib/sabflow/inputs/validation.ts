/**
 * SabFlow input validation — pure, framework-agnostic functions used by
 * the chat runtime (ChatWindow) and anywhere server-side validation is
 * needed.  Each validator returns a discriminated union so callers can
 * branch on `valid` without threading error strings:
 *
 *   const result = validateEmail(value);
 *   if (!result.valid) showError(result.error);
 */

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/* ── shared helpers ─────────────────────────────────────────────────── */

const OK: ValidationResult = { valid: true };

const fail = (error: string): ValidationResult => ({ valid: false, error });

function isBlank(value: string | undefined | null): boolean {
  return value === undefined || value === null || value.trim() === '';
}

/* ── email ──────────────────────────────────────────────────────────── */

/**
 * Simplified RFC 5322 regex: covers the practical subset used on web
 * forms without admitting absurdities (quoted locals, IP literals, …).
 * Source: https://html.spec.whatwg.org/#valid-e-mail-address
 */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function validateEmail(
  value: string,
  options?: { allowEmpty?: boolean },
): ValidationResult {
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) {
    return options?.allowEmpty
      ? OK
      : fail('Please enter an email address.');
  }

  if (!EMAIL_RE.test(trimmed)) {
    return fail('Please enter a valid email address.');
  }

  const domain = trimmed.split('@')[1] ?? '';
  if (!domain.includes('.')) {
    return fail('Email domain must include a dot, e.g. "example.com".');
  }

  return OK;
}

/* ── phone ──────────────────────────────────────────────────────────── */

const PERMISSIVE_PHONE_RE = /^[\d\s\-+()]{7,20}$/;

/**
 * Minimal structural shape of libphonenumber-js we rely on.  We load the
 * library through a dynamic `import()` so apps that do not depend on it
 * still bundle fine.
 */
type LibPhoneNumberModule = {
  isValidPhoneNumber?: (value: string, country?: string) => boolean;
  parsePhoneNumberFromString?: (
    value: string,
    country?: string,
  ) => { isValid?: () => boolean } | undefined;
};

let libPhoneNumberCache: LibPhoneNumberModule | null | undefined;

async function loadLibPhoneNumber(): Promise<LibPhoneNumberModule | null> {
  if (libPhoneNumberCache !== undefined) return libPhoneNumberCache;
  try {
    // Dynamic + ignored by bundler-static-analysis so a missing package
    // does not break the build.  The string concat defeats static
    // resolution in some bundlers while still being resolved at runtime.
    const moduleName = 'libphonenumber' + '-js';
    const mod = (await import(
      /* webpackIgnore: true */ /* @vite-ignore */ moduleName
    )) as LibPhoneNumberModule;
    libPhoneNumberCache = mod;
    return mod;
  } catch {
    libPhoneNumberCache = null;
    return null;
  }
}

/**
 * Validate a phone number.  Uses `libphonenumber-js` when available for
 * country-aware validation, otherwise falls back to a permissive regex
 * that matches common international formats.
 */
export async function validatePhone(
  value: string,
  options?: { country?: string; allowEmpty?: boolean },
): Promise<ValidationResult> {
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) {
    return options?.allowEmpty
      ? OK
      : fail('Please enter a phone number.');
  }

  const lib = await loadLibPhoneNumber();
  if (lib?.isValidPhoneNumber) {
    const ok = lib.isValidPhoneNumber(trimmed, options?.country);
    return ok
      ? OK
      : fail(
          options?.country
            ? 'Please enter a valid phone number for your country.'
            : 'Please enter a valid phone number including the country code.',
        );
  }

  if (lib?.parsePhoneNumberFromString) {
    const parsed = lib.parsePhoneNumberFromString(trimmed, options?.country);
    const ok = parsed?.isValid?.();
    if (ok) return OK;
  }

  if (!PERMISSIVE_PHONE_RE.test(trimmed)) {
    return fail(
      'Phone number must be 7–20 digits and may include spaces, dashes, or parentheses.',
    );
  }

  // Require some digits even with symbols.
  const digitCount = trimmed.replace(/\D/g, '').length;
  if (digitCount < 7) {
    return fail('Phone number is too short.');
  }

  return OK;
}

/**
 * Synchronous phone validator — always uses the permissive regex.  Handy
 * in contexts that cannot `await` (legacy sync code paths).
 */
export function validatePhoneSync(
  value: string,
  options?: { allowEmpty?: boolean },
): ValidationResult {
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) {
    return options?.allowEmpty
      ? OK
      : fail('Please enter a phone number.');
  }
  if (!PERMISSIVE_PHONE_RE.test(trimmed)) {
    return fail(
      'Phone number must be 7–20 digits and may include spaces, dashes, or parentheses.',
    );
  }
  const digitCount = trimmed.replace(/\D/g, '').length;
  if (digitCount < 7) return fail('Phone number is too short.');
  return OK;
}

/* ── url ────────────────────────────────────────────────────────────── */

export function validateUrl(
  value: string,
  options?: { requireHttps?: boolean; allowEmpty?: boolean },
): ValidationResult {
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) {
    return options?.allowEmpty ? OK : fail('Please enter a URL.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return fail('Please enter a valid URL, e.g. "https://example.com".');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return fail('URL must start with http:// or https://.');
  }

  if (options?.requireHttps && parsed.protocol !== 'https:') {
    return fail('URL must use HTTPS (https://).');
  }

  return OK;
}

/* ── number ─────────────────────────────────────────────────────────── */

export function validateNumber(
  value: string | number,
  options?: {
    min?: number;
    max?: number;
    integer?: boolean;
    step?: number;
  },
): ValidationResult {
  const raw =
    typeof value === 'number' ? String(value) : (value ?? '').toString().trim();

  if (raw === '') return fail('Please enter a number.');

  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return fail('Please enter a valid number.');
  }

  if (options?.integer && !Number.isInteger(num)) {
    return fail('Please enter a whole number (no decimals).');
  }

  if (options?.min !== undefined && num < options.min) {
    return fail(`Value must be at least ${options.min}.`);
  }

  if (options?.max !== undefined && num > options.max) {
    return fail(`Value must be at most ${options.max}.`);
  }

  if (options?.step !== undefined && options.step > 0) {
    // Floating-point tolerance
    const base = options.min ?? 0;
    const remainder = (num - base) / options.step;
    const rounded = Math.round(remainder);
    if (Math.abs(remainder - rounded) > 1e-9) {
      return fail(`Value must be a multiple of ${options.step}.`);
    }
  }

  return OK;
}

/* ── text ───────────────────────────────────────────────────────────── */

export function validateText(
  value: string,
  options?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    patternMessage?: string;
  },
): ValidationResult {
  const raw = value ?? '';

  if (options?.minLength !== undefined && raw.length < options.minLength) {
    if (options.minLength === 1 && raw.trim() === '') {
      return fail('This field is required.');
    }
    return fail(
      `Please enter at least ${options.minLength} character${
        options.minLength === 1 ? '' : 's'
      }.`,
    );
  }

  if (options?.maxLength !== undefined && raw.length > options.maxLength) {
    return fail(
      `Please enter at most ${options.maxLength} character${
        options.maxLength === 1 ? '' : 's'
      }.`,
    );
  }

  if (options?.pattern) {
    let re: RegExp;
    try {
      re = new RegExp(options.pattern);
    } catch {
      // If pattern itself is invalid, treat as pass-through rather than
      // blocking the user on an author mistake.
      return OK;
    }
    if (!re.test(raw)) {
      return fail(options.patternMessage ?? 'Value does not match the expected format.');
    }
  }

  return OK;
}

/* ── date ───────────────────────────────────────────────────────────── */

function parseDateLike(
  value: string,
  format: 'date' | 'datetime',
): Date | null {
  if (!value) return null;
  // Accept either ISO (YYYY-MM-DD / YYYY-MM-DDTHH:mm) or anything Date
  // can parse. We deliberately normalise a date-only string to midnight
  // UTC so comparisons with min/max work predictably.
  if (format === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + 'T00:00:00Z');
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function validateDate(
  value: string,
  options?: { min?: string; max?: string; format?: 'date' | 'datetime' },
): ValidationResult {
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) return fail('Please select a date.');

  const format = options?.format ?? 'date';
  const parsed = parseDateLike(trimmed, format);
  if (!parsed) {
    return fail(
      format === 'datetime'
        ? 'Please enter a valid date and time.'
        : 'Please enter a valid date.',
    );
  }

  if (options?.min) {
    const min = parseDateLike(options.min, format);
    if (min && parsed.getTime() < min.getTime()) {
      return fail(`Date must be on or after ${options.min}.`);
    }
  }

  if (options?.max) {
    const max = parseDateLike(options.max, format);
    if (max && parsed.getTime() > max.getTime()) {
      return fail(`Date must be on or before ${options.max}.`);
    }
  }

  return OK;
}

/* ── time ───────────────────────────────────────────────────────────── */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function timeToMinutes(value: string): number | null {
  const m = TIME_RE.exec(value);
  if (!m) return null;
  const hours = Number(m[1]);
  const mins = Number(m[2]);
  return hours * 60 + mins;
}

export function validateTime(
  value: string,
  options?: { min?: string; max?: string },
): ValidationResult {
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) return fail('Please enter a time.');

  const mins = timeToMinutes(trimmed);
  if (mins === null) {
    return fail('Please enter a valid time in HH:MM format.');
  }

  if (options?.min) {
    const minMins = timeToMinutes(options.min);
    if (minMins !== null && mins < minMins) {
      return fail(`Time must be at or after ${options.min}.`);
    }
  }

  if (options?.max) {
    const maxMins = timeToMinutes(options.max);
    if (maxMins !== null && mins > maxMins) {
      return fail(`Time must be at or before ${options.max}.`);
    }
  }

  return OK;
}

/* ── file ───────────────────────────────────────────────────────────── */

/**
 * Returns true if the given file matches one of the accepted type
 * patterns.  Patterns may be exact MIME types (e.g. "image/png"), MIME
 * wildcards ("image/*"), or extensions (".pdf").
 */
function fileMatchesAccepted(file: File, accepted: string[]): boolean {
  if (accepted.length === 0) return true;
  const name = file.name.toLowerCase();
  const mime = (file.type || '').toLowerCase();

  return accepted.some((raw) => {
    const pattern = raw.trim().toLowerCase();
    if (!pattern) return false;
    if (pattern.startsWith('.')) {
      return name.endsWith(pattern);
    }
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1); // keep trailing slash
      return mime.startsWith(prefix);
    }
    return mime === pattern;
  });
}

export function validateFile(
  file: File,
  options?: { maxSizeMB?: number; acceptedTypes?: string[] },
): ValidationResult {
  if (!file) return fail('Please select a file.');

  if (options?.maxSizeMB !== undefined && options.maxSizeMB > 0) {
    const maxBytes = options.maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return fail(`File is too large. Maximum size is ${options.maxSizeMB} MB.`);
    }
  }

  if (options?.acceptedTypes && options.acceptedTypes.length > 0) {
    if (!fileMatchesAccepted(file, options.acceptedTypes)) {
      return fail(
        `File type is not allowed. Accepted: ${options.acceptedTypes.join(', ')}.`,
      );
    }
  }

  return OK;
}
