/**
 * Session-domain client for the Rust BFF — `GET /v1/session`.
 *
 * Replaces the Mongo work in `getSession()`: cookie decode stays in
 * Next.js (we still need `userId` to mint the Rust JWT), but the user
 * lookup, plan join, credits init, and permissions merge all run on the
 * Rust side and come back as one JSON payload.
 */
import 'server-only';

import { rustFetch } from './fetcher';

// The session user shape is intentionally open: the Mongo `users`
// document accumulates feature-specific subtrees (CRM pipelines, wallet,
// custom roles, ...) and downstream call sites reach into many of them.
// Typing this as `any` matches the legacy `getSession()` inferred return
// type and avoids cascading errors across hundreds of call sites.
export type RustSessionUser = any;

export type RustSessionResponse = {
    user: RustSessionUser;
};

export const sessionApi = {
    /**
     * `GET /v1/session` — current session bundle (user + plan + merged
     * permissions). Authoritative source for the Next.js layouts and
     * `RBACGuard`.
     */
    me: () => rustFetch<RustSessionResponse>('/v1/session'),
};

export type SessionApi = typeof sessionApi;
