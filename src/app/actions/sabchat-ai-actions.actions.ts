'use server';

/**
 * SabChat action-taking-AI server actions — project-scoped over the
 * `sabchat-ai-actions` Rust crate (`/v1/sabchat/ai/actions/*`). Connector
 * (tool) registry + an `http_webhook` executor + invocation audit.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';
import type {
  SabChatActionRun,
  SabChatConnector,
  SabChatConnectorConfig,
  SabChatInvokeResult,
} from '@/lib/rust-client/sabchat-ai-actions';

const ACTIONS_PATH = '/sabchat/actions';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

type Mut = { ok: true } | { ok: false; error: string };

export async function listConnectors(): Promise<SabChatConnector[]> {
  try {
    const res = await scoped(() => rustClient.sabchatAiActions.listConnectors());
    return res.connectors;
  } catch {
    return [];
  }
}

export async function listActionRuns(): Promise<SabChatActionRun[]> {
  try {
    const res = await scoped(() => rustClient.sabchatAiActions.listRuns());
    return res.runs;
  } catch {
    return [];
  }
}

export async function saveConnector(input: {
  id?: string;
  name: string;
  description?: string;
  config: SabChatConnectorConfig;
  enabled?: boolean;
}): Promise<Mut> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!input.config.url?.trim()) return { ok: false, error: 'A webhook URL is required.' };
  const config: SabChatConnectorConfig = {
    url: input.config.url.trim(),
    method: input.config.method?.trim() || 'POST',
    headers: input.config.headers,
  };
  try {
    await scoped(async () => {
      if (input.id) {
        await rustClient.sabchatAiActions.updateConnector(input.id, {
          name,
          description: input.description?.trim(),
          config,
          enabled: input.enabled,
        });
      } else {
        await rustClient.sabchatAiActions.createConnector({
          name,
          description: input.description?.trim() || undefined,
          kind: 'http_webhook',
          config,
          enabled: input.enabled ?? true,
        });
      }
    });
    revalidatePath(ACTIONS_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function deleteConnector(id: string): Promise<Mut> {
  try {
    await scoped(() => rustClient.sabchatAiActions.deleteConnector(id));
    revalidatePath(ACTIONS_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function invokeConnector(
  id: string,
  inputJson: string,
): Promise<{ ok: true; result: SabChatInvokeResult } | { ok: false; error: string }> {
  let input: unknown = {};
  if (inputJson?.trim()) {
    try {
      input = JSON.parse(inputJson);
    } catch {
      return { ok: false, error: 'Input must be valid JSON.' };
    }
  }
  try {
    const result = await scoped(() => rustClient.sabchatAiActions.invoke(id, { input }));
    revalidatePath(ACTIONS_PATH);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
