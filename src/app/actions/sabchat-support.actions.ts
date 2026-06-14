'use server';

/**
 * SabChat support-config server actions — project-scoped over the
 * sabchat-knowledge, sabchat-sla, and sabchat-csat Rust crates. Powers
 * `/sabchat/knowledge` and `/sabchat/settings`.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';
import type { KbArticle, KbPortal } from '@/lib/rust-client/sabchat-knowledge';
import type { SabChatSla } from '@/lib/rust-client/sabchat-sla';
import type { SabChatSurvey, SabChatSurveyKind } from '@/lib/rust-client/sabchat-csat';

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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `item-${Date.now()}`;
}

/* -- Knowledge base ------------------------------------------------------ */

const KB_PATH = '/sabchat/knowledge';

/** Return the workspace's KB portal, creating a default one if none exists. */
export async function ensureDefaultPortal(): Promise<KbPortal | null> {
  try {
    return await scoped(async () => {
      const { items } = await rustClient.sabchatKb.portals.list();
      if (items.length) return items[0];
      return rustClient.sabchatKb.portals.create({
        name: 'Help Center',
        slug: 'help',
        defaultLanguage: 'en',
      });
    });
  } catch {
    return null;
  }
}

export async function listKbArticles(portalId: string): Promise<KbArticle[]> {
  try {
    const res = await scoped(() => rustClient.sabchatKb.articles.list({ portalId, limit: 200 }));
    return res.items;
  } catch {
    return [];
  }
}

export async function saveKbArticle(input: {
  id?: string;
  portalId: string;
  title: string;
  body: string;
  language?: string;
}): Promise<Mut> {
  const title = input.title?.trim();
  const body = input.body?.trim();
  if (!title || !body) return { ok: false, error: 'Title and body are required.' };
  return mutate(
    () =>
      input.id
        ? rustClient.sabchatKb.articles.update(input.id, { title, body })
        : rustClient.sabchatKb.articles.create({
            portalId: input.portalId,
            title,
            slug: slugify(title),
            body,
            language: input.language ?? 'en',
          }),
    KB_PATH,
  );
}

/**
 * Draft a KB article from a resolved conversation: summarize it with the
 * copilot, then create a `draft`-status article in the default portal seeded
 * with that summary. The agent reviews + publishes from `/sabchat/knowledge`.
 */
export async function draftKbFromConversation(
  conversationId: string,
): Promise<{ ok: true; articleId: string } | { ok: false; error: string }> {
  if (!conversationId) return { ok: false, error: 'No conversation selected.' };
  try {
    const article = await scoped(async () => {
      const { summary } = await rustClient.sabchatAiCopilot.summarize({ conversationId });
      const body = (summary || '').trim();
      if (!body) throw new Error('The copilot returned an empty summary.');
      // First line → title; full summary → body.
      const firstLine = body.split('\n')[0].replace(/^#+\s*/, '').slice(0, 100);
      const title = firstLine || 'Untitled article from chat';

      const portalList = await rustClient.sabchatKb.portals.list();
      const portal =
        portalList.items[0] ??
        (await rustClient.sabchatKb.portals.create({
          name: 'Help Center',
          slug: 'help',
          defaultLanguage: 'en',
        }));

      return rustClient.sabchatKb.articles.create({
        portalId: portal._id,
        title,
        slug: slugify(title),
        body,
        language: portal.defaultLanguage ?? 'en',
        status: 'draft',
      });
    });
    revalidatePath(KB_PATH);
    return { ok: true, articleId: article._id };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export const publishKbArticle = async (id: string) =>
  mutate(() => rustClient.sabchatKb.articles.publish(id), KB_PATH);

export const archiveKbArticle = async (id: string) =>
  mutate(() => rustClient.sabchatKb.articles.archive(id), KB_PATH);

export const deleteKbArticle = async (id: string) =>
  mutate(() => rustClient.sabchatKb.articles.delete(id), KB_PATH);

/* -- SLA policies -------------------------------------------------------- */

const SETTINGS_PATH = '/sabchat/settings';

export async function listSlas(): Promise<SabChatSla[]> {
  try {
    const res = await scoped(() => rustClient.sabchatSla.list());
    return res.items;
  } catch {
    return [];
  }
}

export async function saveSla(input: {
  id?: string;
  name: string;
  firstResponseMinutes?: number;
  resolutionMinutes?: number;
}): Promise<Mut> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'Name is required.' };
  return mutate(
    () =>
      input.id
        ? rustClient.sabchatSla.update(input.id, {
            name,
            firstResponseMinutes: input.firstResponseMinutes,
            resolutionMinutes: input.resolutionMinutes,
          })
        : rustClient.sabchatSla.create({
            name,
            firstResponseMinutes: input.firstResponseMinutes,
            resolutionMinutes: input.resolutionMinutes,
          }),
    SETTINGS_PATH,
  );
}

export const deleteSla = async (id: string) =>
  mutate(() => rustClient.sabchatSla.delete(id), SETTINGS_PATH);

/* -- CSAT surveys -------------------------------------------------------- */

export async function listSurveys(): Promise<SabChatSurvey[]> {
  try {
    const res = await scoped(() => rustClient.sabchatCsat.listSurveys());
    return res.items;
  } catch {
    return [];
  }
}

export async function saveSurvey(input: {
  id?: string;
  name: string;
  kind: SabChatSurveyKind;
  question: string;
}): Promise<Mut> {
  const name = input.name?.trim();
  const question = input.question?.trim();
  if (!name || !question) return { ok: false, error: 'Name and question are required.' };
  return mutate(
    () =>
      input.id
        ? rustClient.sabchatCsat.updateSurvey(input.id, { name, question, kind: input.kind })
        : rustClient.sabchatCsat.createSurvey({ name, kind: input.kind, question }),
    SETTINGS_PATH,
  );
}

export const deleteSurvey = async (id: string) =>
  mutate(() => rustClient.sabchatCsat.deleteSurvey(id), SETTINGS_PATH);
