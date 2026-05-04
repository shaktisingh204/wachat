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

import { usersApi } from './users';

export const rustClient = {
    users: usersApi,
};

export type RustClient = typeof rustClient;

// Re-exports for convenient imports from one path.
export { rustFetch, RustApiError } from './fetcher';
export type { MeResponse, RustErrorEnvelope } from './types';
