'use server';

/**
 * SabCall AI call-intelligence (P4).
 *
 * Text-in/text-out features over the project's canonical LLM gateway
 * (`generateSabcrmText` — AI Gateway → Anthropic → OpenAI ladder): summary +
 * action items, sentiment, and a suggested follow-up message. These run on a
 * transcript; producing the transcript itself (recording → STT) is the
 * infra-bound live step wired on the Asterisk box.
 */

import { generateSabcrmText } from '@/lib/sabcrm/ai-llm.server';
import { getSabcallWorkspaceId } from '@/lib/sabcall/workspace';

export interface CallSummary {
  summary: string;
  actionItems: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function parseSummary(text: string): CallSummary {
  // The model is asked for SUMMARY / ACTIONS / SENTIMENT sections; parse them
  // leniently so a slightly-off format still yields something useful.
  const get = (label: string) => {
    const re = new RegExp(`${label}:?\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z ]+:|$)`, 'i');
    return text.match(re)?.[1]?.trim() ?? '';
  };
  const summary = get('SUMMARY') || text.trim().split('\n')[0] || text.trim();
  const actionsBlock = get('ACTION ITEMS') || get('ACTIONS');
  const actionItems = actionsBlock
    .split('\n')
    .map((l) => l.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);
  const sRaw = get('SENTIMENT').toLowerCase();
  const sentiment: CallSummary['sentiment'] = sRaw.includes('positive')
    ? 'positive'
    : sRaw.includes('negative')
      ? 'negative'
      : sRaw.includes('neutral')
        ? 'neutral'
        : 'unknown';
  return { summary, actionItems, sentiment };
}

/** Summarize a call/voicemail transcript into a summary + action items + sentiment. */
export async function summarizeTranscript(
  transcript: string,
): Promise<Result<CallSummary>> {
  if (!(await getSabcallWorkspaceId())) {
    return { ok: false, error: 'No SabCall project selected.' };
  }
  const clean = transcript.trim();
  if (!clean) return { ok: false, error: 'Nothing to summarize — empty transcript.' };

  const res = await generateSabcrmText({
    system:
      'You are a call-intelligence assistant for a phone system. Given a call ' +
      'or voicemail transcript, respond in EXACTLY this format with these ' +
      'three labelled sections and nothing else:\n' +
      'SUMMARY: <2-3 sentence summary>\n' +
      'ACTION ITEMS:\n- <item>\n- <item>\n' +
      'SENTIMENT: <positive|neutral|negative>',
    prompt: `Transcript:\n${clean}`,
    maxTokens: 500,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: parseSummary(res.text) };
}

/** Draft a short follow-up message for a contact based on the transcript. */
export async function suggestFollowUp(
  transcript: string,
  channel: 'sms' | 'email' = 'sms',
): Promise<Result<string>> {
  if (!(await getSabcallWorkspaceId())) {
    return { ok: false, error: 'No SabCall project selected.' };
  }
  const clean = transcript.trim();
  if (!clean) return { ok: false, error: 'Nothing to draft from — empty transcript.' };

  const res = await generateSabcrmText({
    system:
      `You draft concise, professional follow-up ${channel} messages after a ` +
      'phone call. Output ONLY the message text — no preamble, no quotes. Keep ' +
      (channel === 'sms' ? 'it under 320 characters.' : 'it to a short paragraph.'),
    prompt: `Call transcript:\n${clean}\n\nWrite the follow-up ${channel}:`,
    maxTokens: 300,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.text.trim() };
}
