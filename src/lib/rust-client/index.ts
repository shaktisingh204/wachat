/**
 * Public entry point for the Rust BFF client.
 *
 * Use a single `rustClient` namespace so call sites read like
 * `rustClient.users.me()` regardless of which domain crate they hit.
 * As more Rust crates come online (projects, contacts, broadcasts, …)
 * register them here.
 *
 * This module is `server-only` — the underlying fetcher mints JWTs using a
 * shared secret that must never reach the browser bundle.
 */
import 'server-only';

import { templatesApi } from './templates';
import { usersApi } from './users';
import { wachatWebhookApi } from './wachat-webhook';

export const rustClient = {
    users: usersApi,
    wachatWebhook: wachatWebhookApi,
    templates: templatesApi,
};

export type RustClient = typeof rustClient;

// Re-exports for convenient imports from one path.
export { rustFetch, RustApiError } from './fetcher';
export type { MeResponse, RustErrorEnvelope } from './types';
export type {
    WebhookLogSummary,
    ListLogsResp,
    ListLogsQuery,
} from './wachat-webhook';
export type {
    RustTemplate,
    RustLibraryTemplate,
    CreateTemplateBody,
    BulkCreateBody,
    CreateFlowTemplateBody,
    EditTemplateBody,
    SyncBody,
    SendTemplateBody,
    SyncOutcome,
    BulkCreateOutcome,
    SendOutcome,
    ApplyLibraryOutcome,
    TemplatesApi,
} from './templates';
