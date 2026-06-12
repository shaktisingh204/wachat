/**
 * SabSMS AI agent — guardrails (V2.12, runs BEFORE the agent).
 *
 * Closes V2.2's "any reasonable method" opt-out gap: the engine already
 * suppresses on exact STOP keywords; this layer classifies NATURAL
 * LANGUAGE opt-outs ("please don't text me anymore") on every inbound
 * to a marketing-ish conversation, writes the suppression + consent
 * trail, queues the TCPA confirmation through the full engine stack
 * (`sabsmsEngine.enqueueSend` — compliance/credits/routing), and marks
 * the conversation so the agent runtime never replies to that message.
 *
 * Cost discipline: a pure regex pre-pass short-circuits the obvious
 * cases in both directions WITHOUT an LLM call; only genuinely
 * ambiguous bodies reach the gateway, and they are PII-scrubbed first.
 *
 * Worker-safe: relative imports only, no `server-only`, no `@/` paths.
 */

import { createHash } from 'node:crypto';

import { defaultSabsmsLlmClient, parseLlmJson, type SabsmsLlmClient } from './llm';

// ─── PII scrubbing (pure) ──────────────────────────────────────────────────

/** Reversible scrub result — `restore` re-inserts the originals. */
export interface PiiScrubResult {
  text: string;
  /** placeholder → original */
  replacements: Map<string, string>;
  restore: (text: string) => string;
}

const EMAIL_RX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// E.164-ish / formatted phone numbers: optional +, 7–15 digits allowing
// separators. Anchored on digit runs so prices ("$12.50") survive.
const PHONE_RX = /\+?\d[\d\s().-]{5,17}\d/g;
// Long digit runs (12+) — card/account numbers etc.
const LONG_DIGITS_RX = /\d{12,}/g;

function countDigits(s: string): number {
  let n = 0;
  for (const c of s) if (c >= '0' && c <= '9') n += 1;
  return n;
}

/**
 * Mask phone numbers, emails, and 12+ digit sequences with stable
 * placeholders (`«PII_PHONE_1»`, …) before any text leaves the box for
 * an LLM. Returns a reversible mapping so features that rewrite text
 * (composer copy-assist) can restore the originals afterwards.
 */
export function scrubPii(input: string): PiiScrubResult {
  const replacements = new Map<string, string>();
  let counters = { phone: 0, email: 0, digits: 0 };

  const sub = (kind: 'PHONE' | 'EMAIL' | 'DIGITS', original: string): string => {
    const key = kind.toLowerCase() as keyof typeof counters;
    counters = { ...counters, [key]: counters[key] + 1 };
    const placeholder = `«PII_${kind}_${counters[key]}»`;
    replacements.set(placeholder, original);
    return placeholder;
  };

  let text = input.replace(EMAIL_RX, (m) => sub('EMAIL', m));
  text = text.replace(LONG_DIGITS_RX, (m) => sub('DIGITS', m));
  text = text.replace(PHONE_RX, (m) =>
    // Require ≥7 digits so "2 - 4 pm" style fragments survive.
    countDigits(m) >= 7 ? sub('PHONE', m) : m,
  );

  const restore = (out: string): string => {
    let restored = out;
    for (const [placeholder, original] of replacements) {
      restored = restored.split(placeholder).join(original);
    }
    return restored;
  };

  return { text, replacements, restore };
}

/** SHA-256 of the trimmed lowercase phone — same recipe as the inbox. */
export function hashPhone(phone: string): string {
  return createHash('sha256').update(phone.trim().toLowerCase()).digest('hex');
}

// ─── Opt-out intent: regex pre-pass (pure, tested) ─────────────────────────

export type OptOutIntent = 'opt_out' | 'not_opt_out' | 'unclear';

/**
 * Obvious-case short-circuit — returns `null` when the body is genuinely
 * ambiguous and needs the LLM. Engine-side STOP keywords are already
 * handled before this code ever runs; this pre-pass catches the
 * unambiguous NATURAL-LANGUAGE phrasings cheaply.
 */
export function regexOptOutPrePass(body: string): OptOutIntent | null {
  const t = body.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return 'not_opt_out';

  // Bare negation with zero context — ambiguous by definition.
  if (/^(no|don'?t|stop it\?*|why)[.!?]*$/.test(t)) return 'unclear';

  // Unambiguous opt-out phrasings.
  const OPT_OUT_PATTERNS: RegExp[] = [
    /\b(please\s+)?(do\s*n[o']?t|don'?t|never)\s+(text|message|msg|sms|contact|call)\s+me\b/,
    /\bstop\s+(texting|messaging|sending|contacting|spamming)\b/,
    /\b(remove|take|delete)\s+(me|my\s+(number|phone))\s+(from|off)\b.*\b(list|database|system)?/,
    /\bunsubscribe\b/,
    /\bopt\s*[- ]?\s*out\b/,
    /\bi\s+(want|wish|would\s+like)\s+to\s+(stop|unsubscribe|opt\s*out)\b/,
    /\bno\s+more\s+(texts?|messages?|msgs?|sms)\b/,
    /\bleave\s+me\s+alone\b/,
    /\bquit\s+(texting|messaging)\s+me\b/,
    /\bwrong\s+number\b.*\b(stop|remove)\b/,
  ];
  if (OPT_OUT_PATTERNS.some((rx) => rx.test(t))) return 'opt_out';

  // Clear NON-opt-out usages of stop-adjacent words.
  const NOT_OPT_OUT_PATTERNS: RegExp[] = [
    /\bstop\s+by\b/, // "stop by the store"
    /\b(bus|truck|pit|rest)\s+stop\b/,
    /\bnon[- ]?stop\b/,
    /\bcan'?t\s+stop\b/, // "can't stop laughing"
    /\bstop\s+(the|that)\s+(sale|deal|order|car)\b/,
  ];
  if (NOT_OPT_OUT_PATTERNS.some((rx) => rx.test(t))) return 'not_opt_out';

  // Bodies with no opt-out-ish vocabulary at all → clearly not opt-out.
  const SIGNAL =
    /\b(stop|unsubscribe|opt|remove|don'?t|do\s*not|never|quit|enough|spam|leave|cease|block)\b/;
  if (!SIGNAL.test(t)) return 'not_opt_out';

  // Has opt-out-ish vocabulary but matched nothing conclusive → LLM.
  return null;
}

// ─── Opt-out intent: LLM classifier ────────────────────────────────────────

const CLASSIFIER_SYSTEM = `You classify a single inbound SMS reply for opt-out intent.
Answer ONLY with a JSON object: {"intent":"opt_out"} or {"intent":"not_opt_out"} or {"intent":"unclear"}.

Rules:
- "opt_out": the sender clearly wants to stop receiving these messages, in any phrasing.
- "not_opt_out": the message clearly is about something else, even if it contains words like "stop".
- "unclear": genuinely ambiguous. When in doubt, prefer "unclear" over guessing.
- Sarcasm/quoting ("I said STOP joking around") about the word STOP is NOT an opt-out unless the sender also wants the messages to stop.

Examples:
- "please don't text me anymore" -> {"intent":"opt_out"}
- "stop by the store when you can" -> {"intent":"not_opt_out"}
- "don't" -> {"intent":"unclear"}
- "remove me from your list" -> {"intent":"opt_out"}
- "omg stop, that discount is crazy good" -> {"intent":"not_opt_out"}
- "I said STOP joking around" -> {"intent":"not_opt_out"}
- "enough" -> {"intent":"unclear"}`;

/**
 * Classify an inbound body for opt-out intent.
 *
 * Fast path: the pure regex pre-pass decides obvious cases with NO LLM
 * call. Ambiguous bodies are PII-scrubbed and sent to the project's LLM
 * gateway. Any gateway/parse failure degrades to 'unclear' (fail-safe:
 * 'unclear' only FLAGS the conversation; it never suppresses and never
 * lets the agent reply to a possible opt-out unchecked).
 */
export async function classifyOptOutIntent(
  body: string,
  llm: SabsmsLlmClient = defaultSabsmsLlmClient,
): Promise<OptOutIntent> {
  const prePass = regexOptOutPrePass(body);
  if (prePass !== null) return prePass;

  const scrubbed = scrubPii(body).text;
  const res = await llm({
    system: CLASSIFIER_SYSTEM,
    prompt: `Inbound SMS: ${JSON.stringify(scrubbed.slice(0, 600))}`,
    maxTokens: 64,
  });
  if (!res.ok) return 'unclear';
  const parsed = parseLlmJson(res.text);
  const intent = parsed?.intent;
  if (intent === 'opt_out' || intent === 'not_opt_out' || intent === 'unclear') {
    return intent;
  }
  return 'unclear';
}

// ─── Quiet-hours awareness (pure — the ENGINE owns enforcement) ────────────

/**
 * Mirror of the engine's quiet-hours category rule
 * (`services/sabsms-engine/src/compliance/quiet_hours.rs`): ONLY
 * `marketing` is window-restricted; transactional/otp/alert/service are
 * exempt. Agent replies and TCPA confirmations go out as
 * `service`/`transactional`, so the expected engine verdict is
 * "exempt" — we still send through `enqueueSend` unconditionally and
 * let the engine reschedule if its table ever changes. This helper only
 * exists so every turn can LOG the expectation (V2.12 spec).
 */
export function quietHoursExpectation(
  category: string,
): 'exempt' | 'engine_may_reschedule' {
  return category === 'marketing' ? 'engine_may_reschedule' : 'exempt';
}
