/**
 * Cross-channel social posting calendar.
 *
 * `schedulePost` registers a post for future publication and emits a
 * `social.scheduled` event so downstream workers (queue, notifications)
 * can react. Storage is left to the caller via the `store` adapter.
 */
import type { SocialPost, SocialChannel } from './types';

export type SocialEventName = 'social.scheduled' | 'social.published' | 'social.failed';

export type SocialEvent = {
  name: SocialEventName;
  post: SocialPost;
  at: string;
};

type Listener = (e: SocialEvent) => void | Promise<void>;
const listeners = new Map<SocialEventName, Set<Listener>>();

export function onSocialEvent(name: SocialEventName, fn: Listener): () => void {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name)!.add(fn);
  return () => listeners.get(name)?.delete(fn);
}

async function emit(name: SocialEventName, post: SocialPost): Promise<void> {
  const set = listeners.get(name);
  if (!set) return;
  const evt: SocialEvent = { name, post, at: new Date().toISOString() };
  for (const fn of set) {
    try { await fn(evt); } catch { /* listener errors must not break scheduling */ }
  }
}

export interface SocialPostStore {
  save(post: SocialPost): Promise<SocialPost>;
}

let store: SocialPostStore | null = null;
export function setSocialStore(s: SocialPostStore | null): void {
  store = s;
}

export type SchedulePostInput = Omit<SocialPost, 'id' | 'status'> & { id?: string };

export async function schedulePost(input: SchedulePostInput): Promise<SocialPost> {
  if (!input.body || !input.body.trim()) {
    throw new Error('SocialPost: body is required');
  }
  if (!isValidIso(input.scheduledFor)) {
    throw new Error('SocialPost: scheduledFor must be a valid ISO timestamp');
  }
  const post: SocialPost = {
    ...input,
    id: input.id ?? cryptoId(),
    status: 'scheduled',
  };
  if (store) await store.save(post);
  await emit('social.scheduled', post);
  return post;
}

/** Schedule the same content across multiple channels. */
export async function scheduleCampaign(
  base: Omit<SchedulePostInput, 'channel'>,
  channels: SocialChannel[],
): Promise<SocialPost[]> {
  const out: SocialPost[] = [];
  for (const channel of channels) {
    out.push(await schedulePost({ ...base, channel }));
  }
  return out;
}

/** Filter a list of posts to those due to publish at or before `now`. */
export function dueForPublish(posts: SocialPost[], now: Date = new Date()): SocialPost[] {
  return posts.filter((p) => p.status === 'scheduled' && new Date(p.scheduledFor) <= now);
}

/** Build a calendar bucket grouped by day (YYYY-MM-DD). */
export function bucketByDay(posts: SocialPost[]): Record<string, SocialPost[]> {
  const out: Record<string, SocialPost[]> = {};
  for (const p of posts) {
    const day = p.scheduledFor.slice(0, 10);
    (out[day] ??= []).push(p);
  }
  return out;
}

function isValidIso(s: string): boolean {
  if (typeof s !== 'string') return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function cryptoId(): string {
  // Use globalThis.crypto when available, else a deterministic-ish fallback.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
