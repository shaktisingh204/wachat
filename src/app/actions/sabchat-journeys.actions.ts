'use server';

/**
 * SabChat outbound-journeys server actions — project-scoped over the
 * `sabchat-journeys` Rust crate (`/v1/sabchat/journeys/*`). Journey + run CRUD,
 * contact enrollment (by id or tag segment), and a manual tick. The cron route
 * `/api/cron/sabchat-journeys` drives the tick + drains the outbox on a
 * schedule; these actions back the `/sabchat/journeys` UI.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { deliverChatOutbox } from '@/lib/sabchat/journey-dispatch';
import { getErrorMessage } from '@/lib/utils';
import type {
  SabChatJourney,
  SabChatJourneyRun,
  SabChatJourneyStep,
  SabChatJourneyStatus,
} from '@/lib/rust-client/sabchat-journeys';

const JOURNEYS_PATH = '/sabchat/journeys';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

type Mut = { ok: true } | { ok: false; error: string };

export async function listJourneys(): Promise<SabChatJourney[]> {
  try {
    const res = await scoped(() => rustClient.sabchatJourneys.list());
    return res.journeys;
  } catch {
    return [];
  }
}

export async function getJourney(
  id: string,
): Promise<{ journey: SabChatJourney; runs: SabChatJourneyRun[] } | null> {
  try {
    return await scoped(() => rustClient.sabchatJourneys.get(id));
  } catch {
    return null;
  }
}

export async function createJourney(
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!name?.trim()) return { ok: false, error: 'A name is required.' };
  try {
    const res = await scoped(() => rustClient.sabchatJourneys.create({ name: name.trim() }));
    revalidatePath(JOURNEYS_PATH);
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function saveJourney(
  id: string,
  patch: { name?: string; status?: SabChatJourneyStatus; steps?: SabChatJourneyStep[] },
): Promise<Mut> {
  try {
    await scoped(() => rustClient.sabchatJourneys.update(id, patch));
    revalidatePath(JOURNEYS_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function deleteJourney(id: string): Promise<Mut> {
  try {
    await scoped(() => rustClient.sabchatJourneys.remove(id));
    revalidatePath(JOURNEYS_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function enrollContacts(
  id: string,
  input: { contactIds?: string[]; tag?: string },
): Promise<{ ok: true; enrolled: number } | { ok: false; error: string }> {
  if (!input.contactIds?.length && !input.tag?.trim())
    return { ok: false, error: 'Provide contact ids or a tag to enroll.' };
  try {
    const res = await scoped(() =>
      rustClient.sabchatJourneys.enroll(id, {
        contactIds: input.contactIds,
        tag: input.tag?.trim() || undefined,
      }),
    );
    revalidatePath(JOURNEYS_PATH);
    return { ok: true, enrolled: res.enrolled };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/**
 * Manually advance due runs AND deliver the resulting chat messages (the cron
 * route does both on a schedule). Returns the combined tick + delivery counts.
 */
export async function tickJourneys(): Promise<
  | {
      ok: true;
      advanced: number;
      messagesEnqueued: number;
      completed: number;
      delivered: number;
    }
  | { ok: false; error: string }
> {
  try {
    const res = await scoped(async () => {
      const tick = await rustClient.sabchatJourneys.tick({});
      const drain = await deliverChatOutbox();
      return { tick, drain };
    });
    revalidatePath(JOURNEYS_PATH);
    return {
      ok: true,
      advanced: res.tick.advanced,
      messagesEnqueued: res.tick.messagesEnqueued,
      completed: res.tick.completed,
      delivered: res.drain.delivered,
    };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
