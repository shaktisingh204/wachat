'use server';

/**
 * Meta Suite — AI Content Studio server actions (non-streaming).
 *
 * Structured generations (hashtags, post ideas, rewrites) that return parsed
 * JSON. Streaming caption generation lives in the route
 * `/api/meta/ai/generate`. All run through the repo's canonical provider ladder
 * (`wachatLlm`) and degrade safely (never throw; return `{ error }`).
 */

import { wachatLlm, parseJsonLoose } from '@/lib/wachat/ai/client';
import {
  HASHTAG_SYSTEM,
  IDEAS_SYSTEM,
  REWRITE_SYSTEM,
  buildHashtagPrompt,
  buildIdeasPrompt,
  buildRewritePrompt,
  type RewriteMode,
} from '@/lib/meta/ai/prompts';

export interface PostIdea {
  title: string;
  angle: string;
}

/** Suggest relevant hashtags for a brief. */
export async function suggestHashtags(
  brief: string,
  count = 12,
): Promise<{ hashtags?: string[]; error?: string }> {
  if (!brief.trim()) return { error: 'Describe the post first.' };
  const res = await wachatLlm({
    system: HASHTAG_SYSTEM,
    prompt: buildHashtagPrompt(brief, count),
    tier: 'fast',
    maxTokens: 300,
    prefill: '{',
  });
  if (!res.ok) return { error: res.error };
  const parsed = parseJsonLoose<{ hashtags?: unknown }>(res.text);
  const raw = Array.isArray(parsed?.hashtags) ? parsed!.hashtags : [];
  const hashtags = raw
    .filter((h): h is string => typeof h === 'string')
    .map((h) => (h.startsWith('#') ? h : `#${h}`).replace(/\s+/g, ''))
    .filter((h) => h.length > 1)
    .slice(0, count);
  if (hashtags.length === 0) return { error: 'No hashtags returned. Try a more specific brief.' };
  return { hashtags };
}

/** Generate distinct post ideas for a topic. */
export async function suggestPostIdeas(
  topic: string,
  count = 6,
): Promise<{ ideas?: PostIdea[]; error?: string }> {
  if (!topic.trim()) return { error: 'Describe the topic first.' };
  const res = await wachatLlm({
    system: IDEAS_SYSTEM,
    prompt: buildIdeasPrompt(topic, count),
    tier: 'smart',
    maxTokens: 700,
    prefill: '{',
  });
  if (!res.ok) return { error: res.error };
  const parsed = parseJsonLoose<{ ideas?: unknown }>(res.text);
  const raw = Array.isArray(parsed?.ideas) ? parsed!.ideas : [];
  const ideas: PostIdea[] = raw
    .map((i) => {
      const o = (i ?? {}) as { title?: unknown; angle?: unknown };
      return {
        title: typeof o.title === 'string' ? o.title : '',
        angle: typeof o.angle === 'string' ? o.angle : '',
      };
    })
    .filter((i) => i.title)
    .slice(0, count);
  if (ideas.length === 0) return { error: 'No ideas returned. Try a different topic.' };
  return { ideas };
}

/** Rewrite an existing caption in a given mode. */
export async function rewriteCaption(
  text: string,
  mode: RewriteMode,
): Promise<{ text?: string; error?: string }> {
  if (!text.trim()) return { error: 'Nothing to rewrite yet.' };
  const res = await wachatLlm({
    system: REWRITE_SYSTEM,
    prompt: buildRewritePrompt(text, mode),
    tier: 'smart',
    maxTokens: 600,
  });
  if (!res.ok) return { error: res.error };
  const out = res.text.trim().replace(/^["'`]|["'`]$/g, '').trim();
  if (!out) return { error: 'Rewrite returned nothing. Try again.' };
  return { text: out };
}
