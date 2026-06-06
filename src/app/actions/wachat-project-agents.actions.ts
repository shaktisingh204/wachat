'use server';

/**
 * Wachat **project-agents** server actions — the Rust port of the
 * native-Mongo `src/app/wachat/settings/agents/actions.ts` (plus the
 * project-scoped add branch of `handleInviteAgent`).
 *
 * Every body here is a thin shim around `wachatProjectAgentsApi.*`, which
 * targets the `wachat-project-agents` crate mounted at
 * `/v1/wachat/project-agents`. The crate owns all Mongo access + the
 * strict-owner tenancy guards; this file only:
 *
 *   1. validates the inbound args,
 *   2. delegates to the namespace method,
 *   3. re-shapes the response to the legacy `{ count | success | error }`
 *      contract the `AgentsSettingsClient` component already consumes,
 *   4. calls `revalidatePath('/wachat/settings/agents')` on mutations —
 *      exactly the path the legacy action revalidated.
 *
 * NOTE: imported DIRECTLY from the client module (not the rust-client index
 * barrel) so this slice does not depend on a barrel re-export.
 */

import { revalidatePath } from 'next/cache';

import {
    wachatProjectAgentsApi,
    type ProjectAgent,
    type RoutingStrategy,
} from '@/lib/rust-client/wachat-project-agents';
import { getErrorMessage } from '@/lib/utils';

const AGENTS_PATH = '/wachat/settings/agents';

/** Allowed routing strategies — mirrors the crate's closed enum. */
const ROUTING_STRATEGIES: readonly RoutingStrategy[] = [
    'manual',
    'round-robin',
    'skill-based',
];

function isRoutingStrategy(value: string): value is RoutingStrategy {
    return (ROUTING_STRATEGIES as readonly string[]).includes(value);
}

// =================================================================
//  LIST AGENTS
// =================================================================

/**
 * Roster for the project (owner-or-agent read scope on the Rust side).
 * Returns `{ agents }` or `{ error }`.
 */
export async function listProjectAgents(
    projectId: string,
): Promise<{ agents?: ProjectAgent[]; error?: string }> {
    if (!projectId) return { error: 'Project ID is required.' };
    try {
        const r = await wachatProjectAgentsApi.listAgents(projectId);
        return { agents: r.agents };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  INVITE AGENT (project-scoped add of an existing registered user)
// =================================================================

/**
 * Add an existing registered user as an agent on the project.
 *
 * Mirrors the project-scoped add branch of `handleInviteAgent`. The crate
 * returns a clear 404 for un-registered emails so the caller can fall back
 * to the e-mail invitation flow that still lives in `team.actions.ts`.
 */
export async function inviteAgentToProject(
    projectId: string,
    email: string,
    role: string,
): Promise<{ message?: string; error?: string }> {
    const trimmedEmail = email?.trim();
    const trimmedRole = role?.trim();
    if (!projectId || !trimmedEmail || !trimmedRole) {
        return { error: 'Email and role are required.' };
    }
    try {
        const r = await wachatProjectAgentsApi.inviteAgent(projectId, {
            email: trimmedEmail,
            role: trimmedRole,
        });
        revalidatePath(AGENTS_PATH);
        return { message: r.message };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  OPEN-TICKETS PREFLIGHT (before removing an agent)
// =================================================================

/**
 * Count an agent's non-closed assigned contacts — the remove-dialog
 * preflight. Returns the legacy `{ count }` / `{ error }` shape.
 */
export async function getAgentOpenTickets(
    projectId: string,
    agentUserId: string,
): Promise<{ count?: number; error?: string }> {
    if (!projectId || !agentUserId) return { error: 'Missing required fields.' };
    try {
        const r = await wachatProjectAgentsApi.openTickets(projectId, agentUserId);
        return { count: r.count };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  REMOVE AGENT (with ticket reassignment)
// =================================================================

/**
 * Reassign the agent's open tickets (or unassign when
 * `newAgentUserId === null`), then pull them from the project's `agents`
 * array. Returns `{ success }` / `{ error }`.
 */
export async function reassignAndRemoveAgent(
    projectId: string,
    oldAgentUserId: string,
    newAgentUserId: string | null,
): Promise<{ success?: boolean; error?: string }> {
    if (!projectId || !oldAgentUserId) return { error: 'Missing required fields.' };
    try {
        const r = await wachatProjectAgentsApi.removeAgent(projectId, oldAgentUserId, {
            reassignToAgentId: newAgentUserId,
        });
        revalidatePath(AGENTS_PATH);
        return { success: r.success };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  ROUTING STRATEGY
// =================================================================

/**
 * Set `wachatSettings.routingStrategy` on the project. Returns
 * `{ success }` / `{ error }`.
 */
export async function updateProjectRoutingRules(
    projectId: string,
    routingStrategy: string,
): Promise<{ success?: boolean; error?: string }> {
    if (!projectId) return { error: 'Project ID is required.' };
    if (!isRoutingStrategy(routingStrategy)) {
        return { error: "routingStrategy must be 'manual', 'round-robin', or 'skill-based'." };
    }
    try {
        const r = await wachatProjectAgentsApi.updateRouting(projectId, { routingStrategy });
        revalidatePath(AGENTS_PATH);
        return { success: r.success };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  AGENT SKILLS
// =================================================================

/**
 * Replace an agent's `skills` array (`agents.$.skills`). Returns
 * `{ success }` / `{ error }`.
 */
export async function updateAgentSkills(
    projectId: string,
    agentUserId: string,
    skills: string[],
): Promise<{ success?: boolean; error?: string }> {
    if (!projectId || !agentUserId) return { error: 'Missing required fields.' };
    try {
        const r = await wachatProjectAgentsApi.updateSkills(projectId, agentUserId, {
            skills: Array.isArray(skills) ? skills : [],
        });
        revalidatePath(AGENTS_PATH);
        return { success: r.success };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}
