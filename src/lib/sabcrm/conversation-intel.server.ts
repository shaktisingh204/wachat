import 'server-only';

/**
 * SabCRM — conversation intelligence (server-only).
 *
 * Analyzes a conversation transcript via the shared LLM into structured
 * insights (summary / next steps / sentiment / deal-risk). Pure prompt + parse
 * live in `./conversation-intel.ts`. Honest degradation: returns an error when
 * no LLM provider is configured. Fully in-house: the transcript is TEXT the CRM
 * already holds (typed recap, or WhatsApp / SMS / email thread bodies + notes) —
 * no audio, no speech-to-text, no third-party ASR.
 */

import { generateSabcrmText } from './ai-llm.server';
import {
  buildTranscriptPrompt,
  parseAnalysis,
  CONVERSATION_SYSTEM,
  type ConversationAnalysis,
} from './conversation-intel';

export {
  buildTranscriptPrompt,
  parseAnalysis,
  analysisToNote,
  type ConversationAnalysis,
} from './conversation-intel';

export type AnalyzeResult =
  | { ok: true; analysis: ConversationAnalysis }
  | { ok: false; error: string };

/** Analyze a transcript into structured insights. Never throws. */
export async function analyzeTranscript(
  transcript: string,
  contextLabel?: string,
): Promise<AnalyzeResult> {
  const t = (transcript || '').trim();
  if (!t) return { ok: false, error: 'A transcript is required.' };
  try {
    const llm = await generateSabcrmText({
      system: CONVERSATION_SYSTEM,
      prompt: buildTranscriptPrompt(t, contextLabel),
      maxTokens: 800,
    });
    if (!llm.ok) return { ok: false, error: llm.error };
    return { ok: true, analysis: parseAnalysis(llm.text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Analysis failed.' };
  }
}
