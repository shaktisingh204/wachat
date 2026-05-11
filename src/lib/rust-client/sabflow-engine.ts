/**
 * Client for the SabFlow execution engine on the Rust BFF.
 *
 * Routes (mounted at /v1/sabflow by the sabflow-engine crate):
 *   POST   /flows/{flowId}/execute      → triggerExecution
 *   POST   /flows/{flowId}/activate     → activateFlow
 *   POST   /flows/{flowId}/deactivate   → deactivateFlow
 *   GET    /executions/{executionId}    → getExecution
 *   DELETE /executions/{executionId}    → cancelExecution
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/sabflow';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface TriggerExecutionRequest {
  triggerMode?: string;
  triggerData?: unknown;
  initialVariables?: Record<string, string>;
}

export interface TriggerExecutionResponse {
  executionId: string;
  status: string;
  startedAt: string;
}

export interface NodeExecutionResult {
  blockId: string;
  blockType: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  inputData?: unknown;
  outputData?: unknown;
  error?: string;
}

export interface ExecutionRecord {
  id: string;
  executionId: string;
  flowId: string;
  projectId: string;
  status: string;
  triggerMode?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  nodeResults?: NodeExecutionResult[];
  error?: string;
}

export interface ActivateFlowResponse {
  flowId: string;
  status: string;
  message: string;
}

// ── Client functions ──────────────────────────────────────────────────────────

export function triggerExecution(
  flowId: string,
  body: TriggerExecutionRequest = {},
): Promise<TriggerExecutionResponse> {
  return rustFetch(`${BASE}/flows/${flowId}/execute`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function activateFlow(flowId: string): Promise<ActivateFlowResponse> {
  return rustFetch(`${BASE}/flows/${flowId}/activate`, { method: 'POST' });
}

export function deactivateFlow(flowId: string): Promise<ActivateFlowResponse> {
  return rustFetch(`${BASE}/flows/${flowId}/deactivate`, { method: 'POST' });
}

export function getExecution(executionId: string): Promise<ExecutionRecord> {
  return rustFetch(`${BASE}/executions/${executionId}`);
}

export function cancelExecution(executionId: string): Promise<{ ok: boolean }> {
  return rustFetch(`${BASE}/executions/${executionId}`, { method: 'DELETE' });
}
