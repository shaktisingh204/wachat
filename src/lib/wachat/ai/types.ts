/**
 * WaChat AI copilot result types.
 *
 * Kept in a plain module (not the `'use server'` actions file, which may only
 * export async functions) so both server actions and client components can
 * import these shapes.
 */

export interface TranscriptTurn {
  direction: 'in' | 'out';
  text: string;
  at?: string;
}

export interface BrandVoiceInput {
  businessName?: string;
  tone?: string;
  language?: string;
}

export type AiText = { ok: true; text: string } | { ok: false; error: string };

export interface DraftReplyResult {
  ok: boolean;
  error?: string;
  /** Ranked reply suggestions (best first). */
  suggestions: string[];
}

export interface SummaryResult {
  ok: boolean;
  error?: string;
  summary: string;
  keyPoints: string[];
  /** Recommended next action for the agent. */
  nextAction: string;
  /** True if the copilot thinks a human should take over. */
  shouldEscalate: boolean;
}

export interface SentimentResult {
  ok: boolean;
  error?: string;
  /** -1 (very negative) .. 1 (very positive). */
  score: number;
  label: 'positive' | 'neutral' | 'negative';
  emotion?: string;
}

export interface IntentResult {
  ok: boolean;
  error?: string;
  intent: string;
  confidence: number;
  /** Suggested team/queue/agent tag, if any. */
  routeTo?: string;
}

export interface GeneratedTemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
  text: string;
  url?: string;
  phone?: string;
}
export interface GeneratedTemplate {
  ok: boolean;
  error?: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  header?: string;
  body: string;
  footer?: string;
  buttons?: GeneratedTemplateButton[];
  /** Variable example values, indexed from 1. */
  exampleValues?: string[];
}

export interface OptimizeBroadcastResult {
  ok: boolean;
  error?: string;
  improvedBody: string;
  rationale: string;
  /** e.g. "Tue 11:00 local" */
  bestSendTimeHint?: string;
  predictedLift?: string;
  warnings?: string[];
}

export interface SuggestSegmentResult {
  ok: boolean;
  error?: string;
  name: string;
  description: string;
  /** Human-readable filter criteria the UI can map to its builder. */
  criteria: string[];
}
