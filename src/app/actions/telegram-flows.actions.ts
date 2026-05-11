'use server';

/**
 * Server-action surface for the Telegram Flows visual editor.
 *
 * Each action is a thin pass-through to the Rust BFF client (which is itself
 * server-only because it issues a signed JWT). Errors are normalised into the
 * `{ success, error }` envelope shape that the front-end already speaks.
 */

import { RustApiError } from '@/lib/rust-client';
import { telegramFlowsApi } from '@/lib/rust-client/telegram-flows';
import type {
  AckResult,
  CreateBody,
  FlowResp,
  FlowStatus,
  ListResp,
  RunsResp,
  TestBody,
  TestResp,
  UpdateBody,
  VersionResp,
  VersionsResp,
} from '@/lib/rust-client/telegram-flows';

function toAck(e: unknown): AckResult {
  if (e instanceof RustApiError) return { success: false, error: e.message };
  return { success: false, error: String(e) };
}

export async function listTelegramFlows(params: {
  projectId: string;
  status?: FlowStatus | '';
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ListResp> {
  try {
    return await telegramFlowsApi.list({
      projectId: params.projectId,
      status: params.status || undefined,
      search: params.search || undefined,
      page: params.page,
      limit: params.limit,
    });
  } catch (e) {
    return {
      flows: [],
      total: 0,
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      error: e instanceof RustApiError ? e.message : String(e),
    };
  }
}

export async function createTelegramFlow(body: CreateBody): Promise<AckResult> {
  try {
    return await telegramFlowsApi.create(body);
  } catch (e) {
    return toAck(e);
  }
}

export async function getTelegramFlow(flowId: string, projectId: string): Promise<FlowResp> {
  try {
    return await telegramFlowsApi.get(flowId, projectId);
  } catch (e) {
    return { error: e instanceof RustApiError ? e.message : String(e) };
  }
}

export async function updateTelegramFlow(flowId: string, body: UpdateBody): Promise<AckResult> {
  try {
    return await telegramFlowsApi.update(flowId, body);
  } catch (e) {
    return toAck(e);
  }
}

export async function deleteTelegramFlow(flowId: string, projectId: string): Promise<AckResult> {
  try {
    return await telegramFlowsApi.delete(flowId, projectId);
  } catch (e) {
    return toAck(e);
  }
}

export async function publishTelegramFlow(flowId: string, projectId: string): Promise<AckResult> {
  try {
    return await telegramFlowsApi.publish(flowId, projectId);
  } catch (e) {
    return toAck(e);
  }
}

export async function enableTelegramFlow(flowId: string, projectId: string): Promise<AckResult> {
  try {
    return await telegramFlowsApi.enable(flowId, projectId);
  } catch (e) {
    return toAck(e);
  }
}

export async function disableTelegramFlow(flowId: string, projectId: string): Promise<AckResult> {
  try {
    return await telegramFlowsApi.disable(flowId, projectId);
  } catch (e) {
    return toAck(e);
  }
}

export async function testTelegramFlow(flowId: string, body: TestBody): Promise<TestResp> {
  try {
    return await telegramFlowsApi.test(flowId, body);
  } catch (e) {
    return {
      success: false,
      steps: [],
      error: e instanceof RustApiError ? e.message : String(e),
    };
  }
}

export async function listTelegramFlowVersions(
  flowId: string,
  projectId: string,
): Promise<VersionsResp> {
  try {
    return await telegramFlowsApi.listVersions(flowId, projectId);
  } catch (e) {
    return { versions: [], error: e instanceof RustApiError ? e.message : String(e) };
  }
}

export async function getTelegramFlowVersion(
  flowId: string,
  version: number,
  projectId: string,
): Promise<VersionResp> {
  try {
    return await telegramFlowsApi.getVersion(flowId, version, projectId);
  } catch (e) {
    return { error: e instanceof RustApiError ? e.message : String(e) };
  }
}

export async function duplicateTelegramFlow(
  flowId: string,
  projectId: string,
): Promise<AckResult> {
  try {
    return await telegramFlowsApi.duplicate(flowId, projectId);
  } catch (e) {
    return toAck(e);
  }
}

export async function listTelegramFlowRuns(
  flowId: string,
  projectId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<RunsResp> {
  try {
    return await telegramFlowsApi.listRuns(flowId, projectId, opts);
  } catch (e) {
    return { runs: [], error: e instanceof RustApiError ? e.message : String(e) };
  }
}
