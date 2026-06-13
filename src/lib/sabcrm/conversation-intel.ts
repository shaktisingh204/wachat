/**
 * SabCRM — conversation intelligence — PURE prompt + parse.
 *
 * `'server-only'`- and I/O-free (unit-testable). Builds the LLM prompt that
 * turns a conversation TRANSCRIPT into structured insights, and parses the
 * model's JSON reply defensively. The LLM call + (optional) timeline write live
 * in `./conversation-intel.server.ts`.
 *
 * Fully in-house: it analyzes transcript TEXT that SabNode already holds — a
 * typed/pasted call recap, or the WhatsApp / SMS / email thread bodies and notes
 * the CRM already captures (SabWa / SabSMS / SabMail). No audio pipeline, no
 * speech-to-text, and no third-party provider — only our own LLM (ai-llm.server).
 */

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'unknown';
export type DealRisk = 'low' | 'medium' | 'high' | 'unknown';

/** Structured analysis of a transcript. */
export interface ConversationAnalysis {
  summary: string;
  nextSteps: string[];
  sentiment: Sentiment;
  /** Deal-risk read from the conversation. */
  risk: DealRisk;
}

export const CONVERSATION_SYSTEM =
  'You are a sales conversation analyst. Given a call/meeting transcript, reply ' +
  'with ONLY a JSON object (no prose, no markdown fences) of the shape: ' +
  '{"summary": string, "nextSteps": string[], "sentiment": "positive"|"neutral"|"negative", ' +
  '"risk": "low"|"medium"|"high"}. Be concise and specific; base everything on ' +
  'the transcript, never invent facts.';

/** Cap transcript length fed to the model (well under context limits). */
export const TRANSCRIPT_CAP = 24_000;

/** Build the user prompt for transcript analysis. */
export function buildTranscriptPrompt(transcript: string, contextLabel?: string): string {
  const t = (transcript || '').slice(0, TRANSCRIPT_CAP);
  const ctx = contextLabel ? `Record: ${contextLabel}\n\n` : '';
  return `${ctx}Transcript:\n${t}\n\nReturn the JSON analysis.`;
}

const VALID_SENTIMENT: ReadonlySet<string> = new Set(['positive', 'neutral', 'negative']);
const VALID_RISK: ReadonlySet<string> = new Set(['low', 'medium', 'high']);

/**
 * Parse the model's reply into a {@link ConversationAnalysis}. Tolerant: pulls
 * the first `{...}` block, JSON-parses it, validates each field, and falls back
 * to using the raw text as the summary when parsing fails (never throws).
 */
export function parseAnalysis(text: string): ConversationAnalysis {
  const fallback: ConversationAnalysis = {
    summary: (text || '').trim().slice(0, 2000),
    nextSteps: [],
    sentiment: 'unknown',
    risk: 'unknown',
  };
  if (!text) return fallback;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return fallback;
  }
  if (!parsed || typeof parsed !== 'object') return fallback;
  const o = parsed as Record<string, unknown>;
  const summary = typeof o.summary === 'string' && o.summary.trim() ? o.summary.trim() : fallback.summary;
  const nextSteps = Array.isArray(o.nextSteps)
    ? o.nextSteps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 12)
    : [];
  const sentiment = VALID_SENTIMENT.has(String(o.sentiment)) ? (o.sentiment as Sentiment) : 'unknown';
  const risk = VALID_RISK.has(String(o.risk)) ? (o.risk as DealRisk) : 'unknown';
  return { summary, nextSteps, sentiment, risk };
}

/** Render an analysis as a timeline-friendly note body. */
export function analysisToNote(a: ConversationAnalysis): string {
  const lines = [`**Call summary:** ${a.summary}`];
  if (a.nextSteps.length) {
    lines.push('', '**Next steps:**', ...a.nextSteps.map((s) => `- ${s}`));
  }
  lines.push('', `_Sentiment: ${a.sentiment} · Deal risk: ${a.risk}_`);
  return lines.join('\n');
}
