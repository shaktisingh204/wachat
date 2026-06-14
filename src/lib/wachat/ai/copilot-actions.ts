'use server';

/**
 * WaChat AI copilot — server actions.
 *
 * The AI feature surface used across the rewrite (inbox, templates,
 * broadcasts, automation). Each action is async, never throws, and returns a
 * typed, serializable result. All LLM calls go through the provider ladder in
 * ./client (AI Gateway → Anthropic → OpenAI). Structured actions force JSON
 * via an assistant prefill and parse loosely.
 *
 * NOTE: this file intentionally exports ONLY async functions (Next 16 server
 * action rule). Result shapes live in ./types; prompt builders in ./prompts.
 */

import { wachatLlm, parseJsonLoose } from './client';
import { brandSystemPrompt, renderTranscript } from './prompts';
import type {
  AnalyticsInsightsResult,
  BrandVoiceInput,
  DraftReplyResult,
  GeneratedTemplate,
  IntentResult,
  OptimizeBroadcastResult,
  SentimentResult,
  SuggestSegmentResult,
  SummaryResult,
  TranscriptTurn,
} from './types';

/* ----------------------------------------------------- draft reply --- */

export async function aiDraftReply(args: {
  transcript: TranscriptTurn[];
  brand?: BrandVoiceInput;
  instruction?: string;
  count?: number;
}): Promise<DraftReplyResult> {
  const count = Math.min(Math.max(args.count ?? 3, 1), 5);
  const system = brandSystemPrompt(
    'Draft short, ready-to-send WhatsApp replies for the human agent to pick from.',
    args.brand,
  );
  const prompt = [
    'Conversation so far:',
    renderTranscript(args.transcript),
    '',
    args.instruction ? `Agent instruction: ${args.instruction}` : '',
    '',
    `Write ${count} distinct reply options the agent could send next. Vary tone/length slightly.`,
    'Return ONLY JSON: {"suggestions": string[]}.',
  ]
    .filter(Boolean)
    .join('\n');

  const res = await wachatLlm({ system, prompt, tier: 'fast', prefill: '{', maxTokens: 700 });
  if (!res.ok) return { ok: false, error: res.error, suggestions: [] };
  const parsed = parseJsonLoose<{ suggestions?: string[] }>(res.text);
  const suggestions = (parsed?.suggestions ?? []).filter((s) => typeof s === 'string' && s.trim());
  if (!suggestions.length) return { ok: false, error: 'No suggestions returned.', suggestions: [] };
  return { ok: true, suggestions: suggestions.slice(0, count) };
}

/* ------------------------------------------------------ summarize --- */

export async function aiSummarizeConversation(args: {
  transcript: TranscriptTurn[];
  brand?: BrandVoiceInput;
}): Promise<SummaryResult> {
  const system = brandSystemPrompt('Summarize the conversation for a support agent taking it over.', args.brand);
  const prompt = [
    'Conversation:',
    renderTranscript(args.transcript),
    '',
    'Return ONLY JSON:',
    '{"summary": string, "keyPoints": string[], "nextAction": string, "shouldEscalate": boolean}',
  ].join('\n');

  const res = await wachatLlm({ system, prompt, tier: 'fast', prefill: '{', maxTokens: 600 });
  const empty = { ok: false, summary: '', keyPoints: [], nextAction: '', shouldEscalate: false };
  if (!res.ok) return { ...empty, error: res.error };
  const p = parseJsonLoose<Partial<SummaryResult>>(res.text);
  if (!p?.summary) return { ...empty, error: 'Could not summarize.' };
  return {
    ok: true,
    summary: p.summary,
    keyPoints: Array.isArray(p.keyPoints) ? p.keyPoints : [],
    nextAction: p.nextAction ?? '',
    shouldEscalate: Boolean(p.shouldEscalate),
  };
}

/* ------------------------------------------------------ translate --- */

export async function aiTranslate(args: {
  text: string;
  targetLanguage: string;
}): Promise<{ ok: boolean; error?: string; text: string }> {
  if (!args.text.trim()) return { ok: false, error: 'Nothing to translate.', text: '' };
  const system = 'You are a precise translator. Preserve meaning, tone, emoji, and WhatsApp formatting. Output only the translation.';
  const prompt = `Translate the following into ${args.targetLanguage}:\n\n${args.text}`;
  const res = await wachatLlm({ system, prompt, tier: 'fast', maxTokens: 700 });
  if (!res.ok) return { ok: false, error: res.error, text: '' };
  return { ok: true, text: res.text.trim() };
}

/* ------------------------------------------------------ sentiment --- */

export async function aiSentiment(args: {
  transcript: TranscriptTurn[];
}): Promise<SentimentResult> {
  const system = 'You are a sentiment analyst for customer support chats. Be calibrated.';
  const prompt = [
    'Rate the CUSTOMER sentiment in this conversation.',
    renderTranscript(args.transcript),
    '',
    'Return ONLY JSON: {"score": number (-1..1), "label": "positive"|"neutral"|"negative", "emotion": string}',
  ].join('\n');
  const res = await wachatLlm({ system, prompt, tier: 'fast', prefill: '{', maxTokens: 200 });
  if (!res.ok) return { ok: false, error: res.error, score: 0, label: 'neutral' };
  const p = parseJsonLoose<Partial<SentimentResult>>(res.text);
  if (!p || typeof p.score !== 'number') return { ok: false, error: 'Could not analyze.', score: 0, label: 'neutral' };
  const label = p.label === 'positive' || p.label === 'negative' ? p.label : 'neutral';
  return { ok: true, score: Math.max(-1, Math.min(1, p.score)), label, emotion: p.emotion };
}

/* --------------------------------------------------------- intent --- */

export async function aiDetectIntent(args: {
  transcript: TranscriptTurn[];
  intents?: string[];
  routes?: string[];
}): Promise<IntentResult> {
  const system = 'You classify the customer’s primary intent for routing. Pick the single best label.';
  const labels = args.intents?.length ? `Choose from: ${args.intents.join(', ')}.` : 'Use a concise lowercase intent label.';
  const routes = args.routes?.length ? `Suggest a routeTo from: ${args.routes.join(', ')} (or omit).` : '';
  const prompt = [
    labels,
    routes,
    renderTranscript(args.transcript),
    '',
    'Return ONLY JSON: {"intent": string, "confidence": number (0..1), "routeTo": string|null}',
  ]
    .filter(Boolean)
    .join('\n');
  const res = await wachatLlm({ system, prompt, tier: 'fast', prefill: '{', maxTokens: 150 });
  if (!res.ok) return { ok: false, error: res.error, intent: 'unknown', confidence: 0 };
  const p = parseJsonLoose<Partial<IntentResult>>(res.text);
  if (!p?.intent) return { ok: false, error: 'Could not classify.', intent: 'unknown', confidence: 0 };
  return {
    ok: true,
    intent: p.intent,
    confidence: typeof p.confidence === 'number' ? Math.max(0, Math.min(1, p.confidence)) : 0.5,
    routeTo: p.routeTo ?? undefined,
  };
}

/* ----------------------------------------------- generate template --- */

export async function aiGenerateTemplate(args: {
  description: string;
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language?: string;
  brand?: BrandVoiceInput;
}): Promise<GeneratedTemplate> {
  const system = brandSystemPrompt(
    'Generate a WhatsApp message template that complies with Meta policy. Keep body ≤ 1024 chars; use {{1}}, {{2}} for variables; avoid prohibited content; pick the correct category.',
    args.brand,
  );
  const prompt = [
    `Create a WhatsApp template for: ${args.description}`,
    args.category ? `Category: ${args.category}.` : 'Choose the most appropriate category.',
    `Language: ${args.language ?? 'en'}.`,
    '',
    'Return ONLY JSON:',
    '{"name": string (snake_case), "category": "MARKETING"|"UTILITY"|"AUTHENTICATION", "language": string, "header": string|null, "body": string, "footer": string|null, "buttons": [{"type":"QUICK_REPLY"|"URL"|"PHONE_NUMBER"|"COPY_CODE","text":string,"url":string|null,"phone":string|null}], "exampleValues": string[]}',
  ].join('\n');
  const res = await wachatLlm({ system, prompt, tier: 'smart', prefill: '{', maxTokens: 900 });
  const empty: GeneratedTemplate = { ok: false, name: '', category: 'UTILITY', language: 'en', body: '' };
  if (!res.ok) return { ...empty, error: res.error };
  const p = parseJsonLoose<Partial<GeneratedTemplate>>(res.text);
  if (!p?.body) return { ...empty, error: 'Could not generate a template.' };
  return {
    ok: true,
    name: p.name ?? 'generated_template',
    category: p.category ?? args.category ?? 'UTILITY',
    language: p.language ?? args.language ?? 'en',
    header: p.header ?? undefined,
    body: p.body,
    footer: p.footer ?? undefined,
    buttons: Array.isArray(p.buttons) ? p.buttons : undefined,
    exampleValues: Array.isArray(p.exampleValues) ? p.exampleValues : undefined,
  };
}

/* --------------------------------------------- optimize broadcast --- */

export async function aiOptimizeBroadcast(args: {
  body: string;
  audience?: string;
  goal?: string;
  brand?: BrandVoiceInput;
}): Promise<OptimizeBroadcastResult> {
  const system = brandSystemPrompt(
    'You optimize WhatsApp broadcast/marketing copy for deliverability and conversion without sounding spammy (which hurts quality rating).',
    args.brand,
  );
  const prompt = [
    `Current message: ${args.body}`,
    args.audience ? `Audience: ${args.audience}` : '',
    args.goal ? `Goal: ${args.goal}` : '',
    '',
    'Improve it. Return ONLY JSON:',
    '{"improvedBody": string, "rationale": string, "bestSendTimeHint": string, "predictedLift": string, "warnings": string[]}',
  ]
    .filter(Boolean)
    .join('\n');
  const res = await wachatLlm({ system, prompt, tier: 'smart', prefill: '{', maxTokens: 700 });
  if (!res.ok) return { ok: false, error: res.error, improvedBody: args.body, rationale: '' };
  const p = parseJsonLoose<Partial<OptimizeBroadcastResult>>(res.text);
  if (!p?.improvedBody) return { ok: false, error: 'Could not optimize.', improvedBody: args.body, rationale: '' };
  return {
    ok: true,
    improvedBody: p.improvedBody,
    rationale: p.rationale ?? '',
    bestSendTimeHint: p.bestSendTimeHint,
    predictedLift: p.predictedLift,
    warnings: Array.isArray(p.warnings) ? p.warnings : undefined,
  };
}

/* ------------------------------------------------ suggest segment --- */

export async function aiSuggestSegment(args: {
  goal: string;
  availableFields?: string[];
}): Promise<SuggestSegmentResult> {
  const system = 'You design audience segments for WhatsApp campaigns from available contact fields.';
  const prompt = [
    `Goal: ${args.goal}`,
    args.availableFields?.length ? `Available fields: ${args.availableFields.join(', ')}` : '',
    '',
    'Return ONLY JSON: {"name": string, "description": string, "criteria": string[]}',
  ]
    .filter(Boolean)
    .join('\n');
  const res = await wachatLlm({ system, prompt, tier: 'smart', prefill: '{', maxTokens: 400 });
  if (!res.ok) return { ok: false, error: res.error, name: '', description: '', criteria: [] };
  const p = parseJsonLoose<Partial<SuggestSegmentResult>>(res.text);
  if (!p?.name) return { ok: false, error: 'Could not suggest a segment.', name: '', description: '', criteria: [] };
  return {
    ok: true,
    name: p.name,
    description: p.description ?? '',
    criteria: Array.isArray(p.criteria) ? p.criteria : [],
  };
}

/* --------------------------------------------- analytics insights --- */

export async function aiAnalyticsInsights(args: {
  /** Free-form metrics block — pass whatever numbers the page has. */
  metrics: Record<string, number | string>;
  /** What surface this is for (e.g. "WhatsApp overview", "delivery report"). */
  context?: string;
  brand?: BrandVoiceInput;
}): Promise<AnalyticsInsightsResult> {
  const system = brandSystemPrompt(
    'You are a WhatsApp messaging analyst. Read the metrics and explain what matters — grounded strictly in the numbers given. Be specific (cite the figures), never invent data.',
    args.brand,
  );
  const lines = Object.entries(args.metrics)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  const prompt = [
    `Metrics for ${args.context ?? 'this WhatsApp account'}:`,
    lines,
    '',
    'Return ONLY JSON:',
    '{"headline": string, "insights": string[] (2-4, each cites a number), "recommendation": string (one concrete next action)}',
  ].join('\n');
  const res = await wachatLlm({ system, prompt, tier: 'fast', prefill: '{', maxTokens: 500 });
  const empty: AnalyticsInsightsResult = { ok: false, headline: '', insights: [], recommendation: '' };
  if (!res.ok) return { ...empty, error: res.error };
  const p = parseJsonLoose<Partial<AnalyticsInsightsResult>>(res.text);
  if (!p?.headline) return { ...empty, error: 'Could not generate insights.' };
  return {
    ok: true,
    headline: p.headline,
    insights: Array.isArray(p.insights) ? p.insights : [],
    recommendation: p.recommendation ?? '',
  };
}
