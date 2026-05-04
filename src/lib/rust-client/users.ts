/**
 * User-domain client for the Rust BFF. Mirrors `rust/crates/users/`.
 *
 * Each method is a one-line shim around {@link rustFetch} so the namespace
 * surface stays close to the OpenAPI operation IDs — when codegen replaces
 * this file the call sites won't change.
 */
import 'server-only';

import { rustFetch } from './fetcher';
import type { MeResponse } from './types';

export const usersApi = {
    /**
     * `GET /v1/me` — current authenticated user's profile.
     *
     * Identity is taken from the Next.js session and forwarded as a JWT;
     * see {@link rustFetch} for the auth contract.
     */
    me: () => rustFetch<MeResponse>('/v1/me'),
};

export type UsersApi = typeof usersApi;
