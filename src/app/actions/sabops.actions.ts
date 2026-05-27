'use server';

/**
 * SabOps server actions — IT operations suite.
 *
 * Wraps the Rust `/v1/sabops/*` BFF behind admin-session-scoped Server
 * Actions. Every action calls `getSession()` and refuses anonymous use;
 * heartbeat/enrollment paths for the actual agent run through
 * `src/app/api/sabops/agent/*` Route Handlers using agent-token bearer
 * auth, not this file.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import {
    endpointsApi,
    type SabopsEndpointCreateInput,
    type SabopsEndpointDoc,
    type SabopsEndpointListParams,
    type SabopsEndpointUpdateInput,
} from '@/lib/rust-client/sabops-endpoints';
import {
    softwareApi,
    type SabopsSoftwareCreateInput,
    type SabopsSoftwareListParams,
} from '@/lib/rust-client/sabops-software-inventory';
import {
    hardwareApi,
    type SabopsHardwareUpsertInput,
} from '@/lib/rust-client/sabops-hardware-inventory';
import {
    patchesApi,
    type SabopsPatchCreateInput,
    type SabopsPatchListParams,
    type SabopsPatchUpdateInput,
} from '@/lib/rust-client/sabops-patches';
import {
    patchPoliciesApi,
    type SabopsPatchPolicyCreateInput,
    type SabopsPatchPolicyUpdateInput,
    type SabopsPolicyListParams,
} from '@/lib/rust-client/sabops-patch-policies';
import {
    mdmProfilesApi,
    type SabopsMdmProfileCreateInput,
    type SabopsMdmProfileListParams,
    type SabopsMdmProfileUpdateInput,
} from '@/lib/rust-client/sabops-mdm-profiles';
import {
    mdmCommandsApi,
    type SabopsMdmCommandKind,
    type SabopsMdmCommandListParams,
} from '@/lib/rust-client/sabops-mdm-commands';
import {
    adDomainsApi,
    type SabopsAdDomainCreateInput,
    type SabopsAdDomainUpdateInput,
} from '@/lib/rust-client/sabops-ad-domains';
import {
    adUsersApi,
    type SabopsAdUserListParams,
    type SabopsAdUserUpsertInput,
} from '@/lib/rust-client/sabops-ad-users';
import {
    adGroupsApi,
    type SabopsAdGroupListParams,
    type SabopsAdGroupUpsertInput,
} from '@/lib/rust-client/sabops-ad-groups';
import {
    alertsApi,
    type SabopsAlertCreateInput,
    type SabopsAlertListParams,
} from '@/lib/rust-client/sabops-alerts';
import {
    agentTokensApi,
    type SabopsAgentTokenIssueInput,
} from '@/lib/rust-client/sabops-agent-tokens';
import type { SabopsOs } from '@/lib/rust-client/sabops-endpoints';

async function requireSession() {
    const session = await getSession();
    if (!session?.user) throw new Error('Unauthorized');
    return session;
}

function revalidateSabops(path?: string) {
    revalidatePath('/dashboard/sabops');
    if (path) revalidatePath(path);
}

/* ─── Endpoints ──────────────────────────────────────────────────────── */

export async function listSabopsEndpoints(params: SabopsEndpointListParams = {}) {
    await requireSession();
    return endpointsApi.list(params);
}

export async function getSabopsEndpoint(id: string): Promise<SabopsEndpointDoc | null> {
    await requireSession();
    try {
        return await endpointsApi.getById(id);
    } catch {
        return null;
    }
}

export async function createSabopsEndpoint(input: SabopsEndpointCreateInput) {
    await requireSession();
    const result = await endpointsApi.create(input);
    revalidateSabops('/dashboard/sabops/endpoints');
    return result;
}

export async function updateSabopsEndpoint(id: string, patch: SabopsEndpointUpdateInput) {
    await requireSession();
    const result = await endpointsApi.update(id, patch);
    revalidateSabops(`/dashboard/sabops/endpoints/${id}`);
    return result;
}

export async function deleteSabopsEndpoint(id: string) {
    await requireSession();
    const result = await endpointsApi.delete(id);
    revalidateSabops('/dashboard/sabops/endpoints');
    return result;
}

/* ─── Inventory ──────────────────────────────────────────────────────── */

export async function listSabopsSoftware(params: SabopsSoftwareListParams = {}) {
    await requireSession();
    return softwareApi.list(params);
}

export async function recordSabopsSoftware(input: SabopsSoftwareCreateInput) {
    await requireSession();
    const result = await softwareApi.create(input);
    revalidateSabops(`/dashboard/sabops/endpoints/${input.endpointId}`);
    return result;
}

export async function listSabopsHardware(endpointId?: string) {
    await requireSession();
    return hardwareApi.list(endpointId);
}

export async function upsertSabopsHardware(input: SabopsHardwareUpsertInput) {
    await requireSession();
    const result = await hardwareApi.upsert(input);
    revalidateSabops(`/dashboard/sabops/endpoints/${input.endpointId}`);
    return result;
}

/* ─── Patches ────────────────────────────────────────────────────────── */

export async function listSabopsPatches(params: SabopsPatchListParams = {}) {
    await requireSession();
    return patchesApi.list(params);
}

export async function createSabopsPatch(input: SabopsPatchCreateInput) {
    await requireSession();
    const result = await patchesApi.create(input);
    revalidateSabops('/dashboard/sabops/patches');
    return result;
}

export async function updateSabopsPatch(id: string, patch: SabopsPatchUpdateInput) {
    await requireSession();
    const result = await patchesApi.update(id, patch);
    revalidateSabops('/dashboard/sabops/patches');
    return result;
}

/* ─── Patch policies ─────────────────────────────────────────────────── */

export async function listSabopsPatchPolicies(params: SabopsPolicyListParams = {}) {
    await requireSession();
    return patchPoliciesApi.list(params);
}

export async function createSabopsPatchPolicy(input: SabopsPatchPolicyCreateInput) {
    await requireSession();
    const result = await patchPoliciesApi.create(input);
    revalidateSabops('/dashboard/sabops/patch-policies');
    return result;
}

export async function updateSabopsPatchPolicy(
    id: string,
    patch: SabopsPatchPolicyUpdateInput,
) {
    await requireSession();
    const result = await patchPoliciesApi.update(id, patch);
    revalidateSabops('/dashboard/sabops/patch-policies');
    return result;
}

export async function deleteSabopsPatchPolicy(id: string) {
    await requireSession();
    const result = await patchPoliciesApi.delete(id);
    revalidateSabops('/dashboard/sabops/patch-policies');
    return result;
}

export async function applySabopsPatchPolicy(policyId: string) {
    await requireSession();
    const result = await patchPoliciesApi.apply(policyId);
    revalidateSabops('/dashboard/sabops/patch-policies');
    return result;
}

/* ─── MDM ────────────────────────────────────────────────────────────── */

export async function listSabopsMdmProfiles(params: SabopsMdmProfileListParams = {}) {
    await requireSession();
    return mdmProfilesApi.list(params);
}

export async function createSabopsMdmProfile(input: SabopsMdmProfileCreateInput) {
    await requireSession();
    const result = await mdmProfilesApi.create(input);
    revalidateSabops('/dashboard/sabops/mdm/profiles');
    return result;
}

export async function updateSabopsMdmProfile(id: string, patch: SabopsMdmProfileUpdateInput) {
    await requireSession();
    const result = await mdmProfilesApi.update(id, patch);
    revalidateSabops('/dashboard/sabops/mdm/profiles');
    return result;
}

export async function deleteSabopsMdmProfile(id: string) {
    await requireSession();
    const result = await mdmProfilesApi.delete(id);
    revalidateSabops('/dashboard/sabops/mdm/profiles');
    return result;
}

export async function deploySabopsMdmProfile(profileId: string, endpointIds: string[]) {
    await requireSession();
    const result = await mdmProfilesApi.deploy(profileId, endpointIds);
    revalidateSabops('/dashboard/sabops/mdm/profiles');
    return result;
}

export async function listSabopsMdmCommands(params: SabopsMdmCommandListParams = {}) {
    await requireSession();
    return mdmCommandsApi.list(params);
}

export async function pushSabopsMdmCommand(
    endpointId: string,
    kind: SabopsMdmCommandKind,
    payload: Record<string, unknown> = {},
) {
    await requireSession();
    const result = await mdmCommandsApi.issue({
        endpointId,
        kind,
        payloadJson: payload,
    });
    revalidateSabops('/dashboard/sabops/mdm/commands');
    return result;
}

/* ─── Active Directory ───────────────────────────────────────────────── */

export async function listSabopsAdDomains(q?: string) {
    await requireSession();
    return adDomainsApi.list(q);
}

export async function createSabopsAdDomain(input: SabopsAdDomainCreateInput) {
    await requireSession();
    const result = await adDomainsApi.create(input);
    revalidateSabops('/dashboard/sabops/ad/domains');
    return result;
}

export async function updateSabopsAdDomain(id: string, patch: SabopsAdDomainUpdateInput) {
    await requireSession();
    const result = await adDomainsApi.update(id, patch);
    revalidateSabops('/dashboard/sabops/ad/domains');
    return result;
}

export async function deleteSabopsAdDomain(id: string) {
    await requireSession();
    const result = await adDomainsApi.delete(id);
    revalidateSabops('/dashboard/sabops/ad/domains');
    return result;
}

/**
 * Trigger a sync for the given AD domain. Today this only stamps
 * `lastSyncAt` in Rust — the real LDAP pull is deferred until the
 * separate AD-bridge service ships. UI shows the "last synced" pill
 * coming back from this call.
 */
export async function syncSabopsAdDomain(domainId: string) {
    await requireSession();
    const result = await adDomainsApi.sync(domainId);
    revalidateSabops('/dashboard/sabops/ad/domains');
    return result;
}

export async function listSabopsAdUsers(params: SabopsAdUserListParams = {}) {
    await requireSession();
    return adUsersApi.list(params);
}

export async function upsertSabopsAdUser(input: SabopsAdUserUpsertInput) {
    await requireSession();
    const result = await adUsersApi.upsert(input);
    revalidateSabops('/dashboard/sabops/ad/users');
    return result;
}

export async function listSabopsAdGroups(params: SabopsAdGroupListParams = {}) {
    await requireSession();
    return adGroupsApi.list(params);
}

export async function upsertSabopsAdGroup(input: SabopsAdGroupUpsertInput) {
    await requireSession();
    const result = await adGroupsApi.upsert(input);
    revalidateSabops('/dashboard/sabops/ad/groups');
    return result;
}

/* ─── Alerts ─────────────────────────────────────────────────────────── */

export async function listSabopsAlerts(params: SabopsAlertListParams = {}) {
    await requireSession();
    return alertsApi.list(params);
}

export async function createSabopsAlert(input: SabopsAlertCreateInput) {
    await requireSession();
    const result = await alertsApi.create(input);
    revalidateSabops('/dashboard/sabops/alerts');
    return result;
}

export async function acknowledgeSabopsAlert(alertId: string) {
    await requireSession();
    const result = await alertsApi.acknowledge(alertId);
    revalidateSabops('/dashboard/sabops/alerts');
    return result;
}

export async function resolveSabopsAlert(alertId: string) {
    await requireSession();
    const result = await alertsApi.resolve(alertId);
    revalidateSabops('/dashboard/sabops/alerts');
    return result;
}

/* ─── Agent enrollment tokens ───────────────────────────────────────── */

export async function listSabopsAgentTokens(includeUsed = false) {
    await requireSession();
    return agentTokensApi.list(includeUsed);
}

export async function issueSabopsAgentToken(args: SabopsAgentTokenIssueInput = {}) {
    await requireSession();
    const result = await agentTokensApi.issue(args);
    revalidateSabops('/dashboard/sabops/enroll');
    return result;
}

export async function revokeSabopsAgentToken(id: string) {
    await requireSession();
    const result = await agentTokensApi.revoke(id);
    revalidateSabops('/dashboard/sabops/enroll');
    return result;
}

/**
 * Server-side redeem helper. Intended to be called from
 * `/api/sabops/agent/enroll` (Route Handler) *after* the bearer token has
 * been validated against the agent-token table. The Route Handler
 * authenticates the agent via the token itself, then forwards the
 * payload here.
 */
export async function redeemSabopsAgentToken(
    token: string,
    endpointInfo: {
        hostname: string;
        os: SabopsOs;
        osVersion?: string;
        agentVersion?: string;
        macAddress?: string;
        serialNumber?: string;
        model?: string;
    },
) {
    // Note: no `requireSession()` here — auth is the bearer token itself.
    // The Route Handler must call this only after validating the token.
    return agentTokensApi.redeem({ token, ...endpointInfo });
}
