'use server';

/**
 * Wachat **number-routing** server actions — backend for the
 * `/wachat/two-line` page (phone-number → team + default-route bindings).
 *
 * Each body is a thin shim around the `wachatNumberRoutingApi` client, which
 * delegates to the Rust `wachat-number-routing` crate (mounted at
 * `/v1/wachat/number-routing`). The crate owns all Mongo CRUD over
 * `wa_number_team_bindings`, scoped to the authenticated user. This file
 * only validates input, delegates, returns a typed envelope, and
 * `revalidatePath`s the page.
 *
 * Teams for the assignment picker come from `rustClient.sabchatTeams.list()`.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import {
    wachatNumberRoutingApi,
    type NumberRoutingBinding,
    type NumberRoutingBindingBody,
    type NumberRoutingRoute,
} from '@/lib/rust-client/wachat-number-routing';
import { getErrorMessage } from '@/lib/utils';

const PAGE_PATH = '/wachat/two-line';

/** Team option for the assignment picker (id + display name). */
export interface RoutingTeamOption {
    id: string;
    name: string;
}

export interface ListBindingsResult {
    bindings: NumberRoutingBinding[];
    teams: RoutingTeamOption[];
    error?: string;
}

export interface MutateBindingResult {
    success: boolean;
    binding?: NumberRoutingBinding;
    error?: string;
}

/** Normalize an arbitrary route string into the typed union. */
function coerceRoute(route: string): NumberRoutingRoute | null {
    return route === 'bot' || route === 'agent' ? route : null;
}

/** Validate + normalize the shared create/update body. */
function buildBody(input: {
    label?: string | null;
    phoneNumberId?: string | null;
    teamId?: string | null;
    defaultRoute?: string | null;
}): { body: NumberRoutingBindingBody } | { error: string } {
    const label = (input.label ?? '').trim();
    const phoneNumberId = (input.phoneNumberId ?? '').trim();
    if (!label || !phoneNumberId) {
        return { error: 'Label and phone number are required.' };
    }
    const defaultRoute = coerceRoute((input.defaultRoute ?? '').trim());
    if (!defaultRoute) {
        return { error: "Default route must be 'bot' or 'agent'." };
    }
    const teamId = (input.teamId ?? '').trim();
    return {
        body: {
            label,
            phoneNumberId,
            defaultRoute,
            ...(teamId ? { teamId } : {}),
        },
    };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List the user's number→team bindings plus the team options used by the
 * assignment picker. Team-loading failures degrade gracefully to an empty
 * list rather than failing the whole page.
 */
export async function listNumberRoutingBindings(): Promise<ListBindingsResult> {
    try {
        const result = await wachatNumberRoutingApi.list();
        let teams: RoutingTeamOption[] = [];
        try {
            const teamsRes = await rustClient.sabchatTeams.list();
            teams = (teamsRes?.items ?? []).map((t) => ({ id: t._id, name: t.name }));
        } catch {
            // Teams are optional context — never block the bindings list on them.
            teams = [];
        }
        return { bindings: result.bindings ?? [], teams };
    } catch (e) {
        return { bindings: [], teams: [], error: getErrorMessage(e) };
    }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createNumberRoutingBinding(input: {
    label?: string | null;
    phoneNumberId?: string | null;
    teamId?: string | null;
    defaultRoute?: string | null;
}): Promise<MutateBindingResult> {
    const built = buildBody(input);
    if ('error' in built) return { success: false, error: built.error };
    try {
        const binding = await wachatNumberRoutingApi.create(built.body);
        revalidatePath(PAGE_PATH);
        return { success: true, binding };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateNumberRoutingBinding(
    id: string,
    input: {
        label?: string | null;
        phoneNumberId?: string | null;
        teamId?: string | null;
        defaultRoute?: string | null;
    },
): Promise<MutateBindingResult> {
    if (!id) return { success: false, error: 'Missing binding id.' };
    const built = buildBody(input);
    if ('error' in built) return { success: false, error: built.error };
    try {
        const res = await wachatNumberRoutingApi.update(id, built.body);
        revalidatePath(PAGE_PATH);
        return { success: res.success };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteNumberRoutingBinding(
    id: string,
): Promise<MutateBindingResult> {
    if (!id) return { success: false, error: 'Missing binding id.' };
    try {
        const res = await wachatNumberRoutingApi.remove(id);
        revalidatePath(PAGE_PATH);
        return { success: res.success };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
