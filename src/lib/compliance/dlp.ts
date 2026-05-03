/**
 * Pure-functional DLP scanner.
 *
 * Combines regex-based detection with custom validators (Luhn for
 * credit cards, Shannon entropy for high-entropy secrets, structural
 * checks for JWTs).  This module does *not* touch the database — it
 * is safe to import from edge runtimes and unit tests.
 */

import type { DlpFinding, DlpRule } from './types';

/* ── Validators ─────────────────────────────────────────────────────── */

/**
 * Luhn checksum — standard credit-card mod-10 algorithm.  Strips
 * separators before computing.
 */
export function luhn(input: string): boolean {
    const digits = input.replace(/[\s-]/g, '');
    if (!/^\d+$/.test(digits)) return false;
    if (digits.length < 12 || digits.length > 19) return false;
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = digits.charCodeAt(i) - 48;
        if (alt) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        sum += n;
        alt = !alt;
    }
    return sum % 10 === 0;
}

/** Shannon entropy in bits-per-character. */
export function shannonEntropy(input: string): number {
    if (input.length === 0) return 0;
    const counts = new Map<string, number>();
    for (const ch of input) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    let h = 0;
    for (const c of counts.values()) {
        const p = c / input.length;
        h -= p * Math.log2(p);
    }
    return h;
}

/**
 * Structural JWT check — must be three base64url segments and the
 * first segment must decode to JSON containing `alg`.
 */
export function looksLikeJwt(input: string): boolean {
    const parts = input.split('.');
    if (parts.length !== 3) return false;
    if (parts.some((p) => p.length === 0)) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(parts.join(''))) return false;
    try {
        const padded =
            parts[0] + '='.repeat((4 - (parts[0].length % 4)) % 4);
        const json = Buffer.from(
            padded.replace(/-/g, '+').replace(/_/g, '/'),
            'base64',
        ).toString('utf8');
        const obj = JSON.parse(json);
        return typeof obj === 'object' && obj !== null && 'alg' in obj;
    } catch {
        return false;
    }
}

/* ── Default rule set ───────────────────────────────────────────────── */

/**
 * Out-of-the-box rule library.  Tenants may extend or override via
 * their own `DlpRule[]` passed into `scan`.
 */
export const DEFAULT_RULES: DlpRule[] = [
    {
        id: 'email',
        name: 'Email address',
        category: 'email',
        // Conservative RFC-5322-ish — avoids over-matching.
        pattern:
            "[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z]{2,})+",
        flags: 'g',
        severity: 'low',
    },
    {
        id: 'phone',
        name: 'Phone number',
        category: 'phone',
        // E.164-friendly: optional +, 7-15 digits, with separators.
        pattern:
            "(?<!\\d)(?:\\+?\\d{1,3}[\\s-]?)?(?:\\(\\d{2,4}\\)[\\s-]?|\\d{2,4}[\\s-]?){2,4}\\d{2,4}(?!\\d)",
        flags: 'g',
        severity: 'low',
    },
    {
        id: 'credit_card',
        name: 'Credit card number',
        category: 'credit_card',
        pattern: "(?<!\\d)(?:\\d[ -]?){12,18}\\d(?!\\d)",
        flags: 'g',
        validator: 'luhn',
        severity: 'high',
    },
    {
        id: 'ssn',
        name: 'US Social Security Number',
        category: 'ssn',
        pattern: "(?<!\\d)\\d{3}-\\d{2}-\\d{4}(?!\\d)",
        flags: 'g',
        severity: 'high',
    },
    {
        id: 'aws_access_key',
        name: 'AWS access key ID',
        category: 'aws_access_key',
        pattern: "(?<![A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])",
        flags: 'g',
        severity: 'critical',
    },
    {
        id: 'aws_secret_key',
        name: 'AWS secret access key',
        category: 'aws_secret_key',
        pattern: "(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])",
        flags: 'g',
        validator: 'entropy',
        minEntropy: 4.5,
        severity: 'critical',
    },
    {
        id: 'jwt',
        name: 'JSON Web Token',
        category: 'jwt',
        pattern: "eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+",
        flags: 'g',
        validator: 'jwt',
        severity: 'high',
    },
    {
        id: 'generic_api_key',
        name: 'Generic API key',
        category: 'api_key',
        // 32+ chars, base64-ish or hex — confirmed by entropy.
        pattern: "(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{32,64}(?![A-Za-z0-9_-])",
        flags: 'g',
        validator: 'entropy',
        minEntropy: 4.0,
        severity: 'medium',
    },
];

/* ── Scanner ────────────────────────────────────────────────────────── */

function runValidator(rule: DlpRule, match: string): boolean {
    switch (rule.validator) {
        case 'luhn':
            return luhn(match);
        case 'entropy':
            return shannonEntropy(match) >= (rule.minEntropy ?? 3.5);
        case 'jwt':
            return looksLikeJwt(match);
        default:
            return true;
    }
}

/**
 * Scan `text` against `rules` and return every match that passes its
 * validator.  Findings are de-duplicated on (start, end, ruleId) so
 * overlapping rules don't double-report.
 */
export function scan(
    text: string,
    rules: DlpRule[] = DEFAULT_RULES,
): DlpFinding[] {
    const findings: DlpFinding[] = [];
    const seen = new Set<string>();

    for (const rule of rules) {
        const flags = rule.flags ?? 'g';
        const re = new RegExp(
            rule.pattern,
            flags.includes('g') ? flags : flags + 'g',
        );
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            const matched = m[0];
            if (matched.length === 0) {
                re.lastIndex++;
                continue;
            }
            if (!runValidator(rule, matched)) continue;
            const key = `${m.index}:${m.index + matched.length}:${rule.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            findings.push({
                ruleId: rule.id,
                ruleName: rule.name,
                category: rule.category,
                severity: rule.severity,
                start: m.index,
                end: m.index + matched.length,
                match: matched,
            });
        }
    }

    findings.sort((a, b) => a.start - b.start || a.ruleId.localeCompare(b.ruleId));
    return findings;
}

/**
 * Convenience wrapper: replace every finding with a fixed-width mask.
 */
export function redact(text: string, findings: DlpFinding[]): string {
    if (findings.length === 0) return text;
    const sorted = [...findings].sort((a, b) => a.start - b.start);
    let out = '';
    let cursor = 0;
    for (const f of sorted) {
        if (f.start < cursor) continue; // overlap — already redacted
        out += text.slice(cursor, f.start);
        out += '*'.repeat(Math.max(1, f.end - f.start));
        cursor = f.end;
    }
    out += text.slice(cursor);
    return out;
}
