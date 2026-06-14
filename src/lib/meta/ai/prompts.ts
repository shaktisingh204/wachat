/**
 * Prompt builders for the Meta Suite AI Content Studio.
 *
 * Pure (no `server-only`) so the streaming route and the server actions can
 * share them. Generation runs through the repo's canonical provider ladder
 * (`wachatLlm` / `wachatLlmStream` in `@/lib/wachat/ai/client`).
 */

export type PostTone =
  | 'friendly'
  | 'professional'
  | 'playful'
  | 'bold'
  | 'inspirational'
  | 'informative';

export type PostGoal =
  | 'engagement'
  | 'traffic'
  | 'awareness'
  | 'promotion'
  | 'leads'
  | 'announcement';

export const TONES: { value: PostTone; label: string }[] = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'playful', label: 'Playful' },
  { value: 'bold', label: 'Bold' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'informative', label: 'Informative' },
];

export const GOALS: { value: PostGoal; label: string }[] = [
  { value: 'engagement', label: 'Engagement' },
  { value: 'traffic', label: 'Drive traffic' },
  { value: 'awareness', label: 'Brand awareness' },
  { value: 'promotion', label: 'Promotion / sale' },
  { value: 'leads', label: 'Lead generation' },
  { value: 'announcement', label: 'Announcement' },
];

export interface CaptionInput {
  brief: string;
  tone?: PostTone;
  goal?: PostGoal;
  pageName?: string;
  includeEmoji?: boolean;
  includeHashtags?: boolean;
  includeCta?: boolean;
  /** Nudge variety across N-of-N regenerations. */
  variantHint?: string;
}

export const CAPTION_SYSTEM =
  'You are a senior social media copywriter who writes high-performing Facebook ' +
  'Page posts. You write natural, human, scroll-stopping copy — never generic ' +
  'AI filler. You respect platform norms: tight first line (the hook is visible ' +
  'before "See more"), short paragraphs, and at most one clear call to action. ' +
  'Output ONLY the post copy itself — no preamble, no quotes, no markdown, no ' +
  'labels like "Caption:".';

export function buildCaptionPrompt(input: CaptionInput): string {
  const lines: string[] = [];
  lines.push(`Write a Facebook Page post about: ${input.brief.trim()}`);
  if (input.pageName) lines.push(`The Page is "${input.pageName}".`);
  if (input.tone) lines.push(`Tone: ${input.tone}.`);
  if (input.goal) lines.push(`Primary goal: ${input.goal}.`);
  lines.push(
    input.includeEmoji
      ? 'Use a few tasteful emoji where they add warmth (not every line).'
      : 'Do not use emoji.',
  );
  lines.push(
    input.includeCta
      ? 'End with one clear, natural call to action.'
      : 'Do not force a call to action.',
  );
  lines.push(
    input.includeHashtags
      ? 'Append 3–5 relevant hashtags on a new final line.'
      : 'Do not include hashtags.',
  );
  lines.push('Keep it under ~80 words unless the topic truly needs more.');
  if (input.variantHint) lines.push(`Make this version distinct: ${input.variantHint}.`);
  return lines.join('\n');
}

export const HASHTAG_SYSTEM =
  'You suggest relevant, real, high-reach Facebook/Instagram hashtags. You return ' +
  'STRICT JSON only.';

export function buildHashtagPrompt(brief: string, count = 12): string {
  return (
    `Suggest ${count} relevant hashtags for a Facebook post about: ${brief.trim()}.\n` +
    'Mix broad and niche tags. No spaces, include the leading #. ' +
    'Return STRICT JSON: {"hashtags": ["#tag1", "#tag2", ...]} and nothing else.'
  );
}

export const IDEAS_SYSTEM =
  'You are a content strategist generating fresh, specific Facebook Page post ideas. ' +
  'You return STRICT JSON only.';

export function buildIdeasPrompt(topic: string, count = 6): string {
  return (
    `Generate ${count} distinct Facebook post ideas for: ${topic.trim()}.\n` +
    'Each idea has a short punchy title and a one-sentence angle. Vary the format ' +
    '(question, tip, story, behind-the-scenes, poll, offer). ' +
    'Return STRICT JSON: {"ideas": [{"title": "...", "angle": "..."}]} and nothing else.'
  );
}

export const REWRITE_SYSTEM = CAPTION_SYSTEM;

export type RewriteMode = 'shorten' | 'lengthen' | 'punchier' | 'professional' | 'casual' | 'fix';

export function buildRewritePrompt(text: string, mode: RewriteMode): string {
  const instruction: Record<RewriteMode, string> = {
    shorten: 'Make it noticeably shorter and tighter while keeping the core message.',
    lengthen: 'Expand it with one more concrete detail or benefit, staying on-topic.',
    punchier: 'Make it punchier and more scroll-stopping, stronger hook.',
    professional: 'Rewrite in a more professional, polished tone.',
    casual: 'Rewrite in a warmer, more casual, conversational tone.',
    fix: 'Fix grammar, spelling and flow without changing the meaning or tone.',
  };
  return `${instruction[mode]}\n\nPost:\n${text.trim()}\n\nReturn ONLY the rewritten post copy.`;
}
