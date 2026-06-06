'use server';

/**
 * Wachat integrations-hub server actions — the OAuth Connections tab on
 * `/wachat/integrations`.
 *
 * Thin shims around the `wachatIntegrationsHubApi` namespace, which is imported
 * DIRECTLY from its client module (the `rustClient` barrel in
 * `@/lib/rust-client` is intentionally NOT touched for this crate). The Rust
 * crate `wachat-integrations-hub` (mounted at `/v1/wachat/integrations`) owns
 * all the Mongo bookkeeping; this file only:
 *
 *   1. validates the provider slug,
 *   2. delegates to the namespace,
 *   3. returns a `{ success, ... }` shaped result,
 *   4. revalidates the integrations page so the connection grid refreshes.
 *
 * Scope: OAuth connections ONLY. razorpay / link / widget / webhooks /
 * api-keys are backed by their own crates and are not duplicated here.
 */

import { revalidatePath } from 'next/cache';

import {
    wachatIntegrationsHubApi,
    type OauthConnection,
    type OauthProvider,
} from '@/lib/rust-client/wachat-integrations-hub';
import { getErrorMessage } from '@/lib/utils';

const INTEGRATIONS_PATH = '/wachat/integrations';

/** Provider slugs the Rust crate accepts. Kept in lockstep with the crate's
 * `KNOWN_PROVIDERS` allowlist so we fail fast before the network call. */
const KNOWN_PROVIDERS: readonly OauthProvider[] = [
    'facebook',
    'shopify',
    'google-analytics',
];

function isKnownProvider(value: string): value is OauthProvider {
    return (KNOWN_PROVIDERS as readonly string[]).includes(value);
}

export interface ListOauthConnectionsResult {
    connections?: OauthConnection[];
    error?: string;
}

export interface OauthMutationResult {
    success: boolean;
    error?: string;
}

/**
 * Load the OAuth connection grid for the current user. Always returns all
 * three known providers (connected or not) — that contract is owned by Rust.
 */
export async function listOauthConnections(): Promise<ListOauthConnectionsResult> {
    try {
        const r = await wachatIntegrationsHubApi.listConnections();
        return { connections: r.connections };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Record an initiated connection intent for a provider. The real OAuth handoff
 * happens elsewhere in Next; this just persists the bookkeeping row so the grid
 * reflects the attempt.
 */
export async function connectOauthProvider(
    provider: string,
    accountLabel?: string,
): Promise<OauthMutationResult> {
    if (!isKnownProvider(provider)) {
        return { success: false, error: `Unknown provider '${provider}'.` };
    }
    try {
        const trimmed = accountLabel?.trim();
        const r = await wachatIntegrationsHubApi.connectProvider(
            provider,
            trimmed ? { accountLabel: trimmed } : undefined,
        );
        revalidatePath(INTEGRATIONS_PATH);
        return { success: r.success };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/** Remove the caller's connection record for a provider. */
export async function disconnectOauthProvider(
    provider: string,
): Promise<OauthMutationResult> {
    if (!isKnownProvider(provider)) {
        return { success: false, error: `Unknown provider '${provider}'.` };
    }
    try {
        const r = await wachatIntegrationsHubApi.disconnectProvider(provider);
        revalidatePath(INTEGRATIONS_PATH);
        return { success: r.success };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}
