/**
 * Client for `/v1/sabchat/ai/actions/*` — action-taking AI: a registry of
 * connectors (tools) the bot can invoke, an `http_webhook` executor that calls
 * the tenant-configured endpoint, and an invocation audit log. Owned by the
 * `sabchat-ai-actions` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabChatConnectorKind = 'http_webhook';

export interface SabChatConnectorConfig {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
}

export interface SabChatConnector {
  _id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  kind: SabChatConnectorKind;
  config: SabChatConnectorConfig;
  inputSchema?: unknown;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SabChatActionRun {
  _id: string;
  tenantId: string;
  connectorId: string;
  conversationId?: string | null;
  input: unknown;
  output: unknown;
  status: 'ok' | 'error';
  httpStatus?: number | null;
  error?: string | null;
  createdAt: string;
}

export interface SabChatInvokeResult {
  runId: string;
  status: 'ok' | 'error';
  httpStatus?: number;
  output: unknown;
  error?: string;
}

export const sabchatAiActionsApi = {
  createConnector: (body: {
    name: string;
    description?: string;
    kind?: SabChatConnectorKind;
    config: SabChatConnectorConfig;
    inputSchema?: unknown;
    enabled?: boolean;
  }) =>
    rustFetch<{ id: string }>('/v1/sabchat/ai/actions/connectors', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listConnectors: () =>
    rustFetch<{ connectors: SabChatConnector[] }>('/v1/sabchat/ai/actions/connectors'),

  updateConnector: (
    id: string,
    body: {
      name?: string;
      description?: string;
      config?: SabChatConnectorConfig;
      inputSchema?: unknown;
      enabled?: boolean;
    },
  ) =>
    rustFetch<{ message: string }>(`/v1/sabchat/ai/actions/connectors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteConnector: (id: string) =>
    rustFetch<{ message: string }>(`/v1/sabchat/ai/actions/connectors/${id}`, { method: 'DELETE' }),

  invoke: (id: string, body: { input: unknown; conversationId?: string }) =>
    rustFetch<SabChatInvokeResult>(`/v1/sabchat/ai/actions/connectors/${id}/invoke`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listRuns: () => rustFetch<{ runs: SabChatActionRun[] }>('/v1/sabchat/ai/actions/runs'),
};
