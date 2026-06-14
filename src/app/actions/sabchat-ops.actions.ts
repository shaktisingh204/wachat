'use server';

/**
 * SabChat ops server actions — project-scoped surfacing of previously-unwired
 * engines: business hours, teams, outbound webhooks, the audit log, and
 * gamification. Every call runs inside `runWithRustTenant(workspaceId, …)`.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';
import type { SabChatBusinessHour } from '@/lib/rust-client/sabchat-business-hours';
import type { SabChatTeam } from '@/lib/rust-client/sabchat-teams';
import type {
  SabChatWebhookEndpoint,
  SabChatWebhookDelivery,
} from '@/lib/rust-client/sabchat-webhooks';
import type {
  SabChatBadge,
  SabChatLeaderboardRow,
} from '@/lib/rust-client/sabchat-gamification';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

type Mut = { ok: true } | { ok: false; error: string };

async function mutate(run: () => Promise<unknown>, path: string): Promise<Mut> {
  try {
    await scoped(run);
    revalidatePath(path);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

const SETTINGS_PATH = '/sabchat/settings';
const ADMIN_PATH = '/sabchat/admin';

/* ── Business hours ────────────────────────────────────────────────────── */

export async function listBusinessHours(): Promise<SabChatBusinessHour[]> {
  try {
    const res = await scoped(() => rustClient.sabchatBusinessHours.list());
    return res.items;
  } catch {
    return [];
  }
}

export async function saveBusinessHours(input: {
  id?: string;
  name: string;
  timezone: string;
  windows: { day: number; open: string; close: string }[];
}): Promise<Mut> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'Name is required.' };
  return mutate(
    () =>
      input.id
        ? rustClient.sabchatBusinessHours.update(input.id, {
            name,
            timezone: input.timezone,
            windows: input.windows,
          })
        : rustClient.sabchatBusinessHours.create({
            name,
            timezone: input.timezone,
            windows: input.windows,
          }),
    SETTINGS_PATH,
  );
}

export const deleteBusinessHours = (id: string) =>
  mutate(() => rustClient.sabchatBusinessHours.delete(id), SETTINGS_PATH);

/* ── Teams ─────────────────────────────────────────────────────────────── */

export async function listTeams(): Promise<SabChatTeam[]> {
  try {
    const res = await scoped(() => rustClient.sabchatTeams.list());
    return res.items;
  } catch {
    return [];
  }
}

export async function saveTeam(input: {
  id?: string;
  name: string;
  description?: string;
}): Promise<Mut> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'Name is required.' };
  return mutate(
    () =>
      input.id
        ? rustClient.sabchatTeams.update(input.id, { name, description: input.description })
        : rustClient.sabchatTeams.create({ name, description: input.description }),
    SETTINGS_PATH,
  );
}

export const deleteTeam = (id: string) =>
  mutate(() => rustClient.sabchatTeams.delete(id), SETTINGS_PATH);

/* ── Webhooks ──────────────────────────────────────────────────────────── */

export const SABCHAT_WEBHOOK_EVENTS = [
  'conversation.created',
  'conversation.updated',
  'conversation.resolved',
  'message.created',
  'contact.created',
  'csat.submitted',
] as const;

export async function listWebhooks(): Promise<SabChatWebhookEndpoint[]> {
  try {
    const res = await scoped(() => rustClient.sabchatWebhooks.listEndpoints());
    return res.items;
  } catch {
    return [];
  }
}

export async function listWebhookDeliveries(
  endpointId?: string,
): Promise<SabChatWebhookDelivery[]> {
  try {
    const res = await scoped(() =>
      rustClient.sabchatWebhooks.listDeliveries({ endpointId, limit: 50 }),
    );
    return res.items;
  } catch {
    return [];
  }
}

export async function saveWebhook(input: {
  id?: string;
  url: string;
  events: string[];
  description?: string;
  active?: boolean;
}): Promise<Mut> {
  const url = input.url?.trim();
  if (!url) return { ok: false, error: 'URL is required.' };
  if (!input.events.length) return { ok: false, error: 'Select at least one event.' };
  return mutate(
    () =>
      input.id
        ? rustClient.sabchatWebhooks.updateEndpoint(input.id, {
            url,
            events: input.events,
            description: input.description,
            active: input.active,
          })
        : rustClient.sabchatWebhooks.createEndpoint({
            url,
            events: input.events,
            description: input.description,
            active: input.active ?? true,
          }),
    ADMIN_PATH,
  );
}

export const deleteWebhook = (id: string) =>
  mutate(() => rustClient.sabchatWebhooks.deleteEndpoint(id), ADMIN_PATH);

export const testWebhook = (id: string) =>
  mutate(() => rustClient.sabchatWebhooks.testEndpoint(id, {}), ADMIN_PATH);

/* ── Audit log ─────────────────────────────────────────────────────────── */

export async function listAuditEvents(): Promise<unknown[]> {
  try {
    const res = await scoped(() => rustClient.sabchat.audit.list({ limit: 100 }));
    return res.events ?? [];
  } catch {
    return [];
  }
}

/* ── Gamification ──────────────────────────────────────────────────────── */

export async function gamificationLeaderboard(
  period = 'month',
): Promise<SabChatLeaderboardRow[]> {
  try {
    const res = await scoped(() =>
      rustClient.sabchatGamification.leaderboard({ period, limit: 50 }),
    );
    return res.items;
  } catch {
    return [];
  }
}

export async function listBadges(): Promise<SabChatBadge[]> {
  try {
    const res = await scoped(() => rustClient.sabchatGamification.listBadges());
    return res.items;
  } catch {
    return [];
  }
}
