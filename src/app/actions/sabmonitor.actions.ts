'use server';

/**
 * SabMonitor server actions.
 *
 * Delegates to the Rust BFF via per-entity rust-client modules. All admin
 * actions are session-authenticated via the platform `getSession()`; the
 * probe-report and trace-ingest entry points authenticate via dedicated
 * probe/trace tokens (TODO — see `recordSabmonitorProbeRun` /
 * `ingestSabmonitorTraceSpan` below).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import {
    sabmonitorCheckApi,
    type SabmonitorCheckCreateInput,
    type SabmonitorCheckListParams,
    type SabmonitorCheckUpdateInput,
} from '@/lib/rust-client/sabmonitor-checks';
import {
    sabmonitorProbeApi,
    type SabmonitorProbeCreateInput,
    type SabmonitorProbeUpdateInput,
} from '@/lib/rust-client/sabmonitor-probes';
import {
    sabmonitorCheckRunApi,
    type SabmonitorReportRunInput,
} from '@/lib/rust-client/sabmonitor-check-runs';
import { sabmonitorIncidentApi } from '@/lib/rust-client/sabmonitor-incidents';
import {
    sabmonitorAlertPolicyApi,
    type SabmonitorAlertPolicyCreateInput,
} from '@/lib/rust-client/sabmonitor-alert-policies';
import {
    sabmonitorStatusPageApi,
    type SabmonitorStatusPageCreateInput,
} from '@/lib/rust-client/sabmonitor-status-pages';
import {
    sabmonitorStatusPageIncidentApi,
    type SabmonitorStatusPageIncidentKind,
} from '@/lib/rust-client/sabmonitor-status-page-incidents';
import { sabmonitorSyntheticScriptApi } from '@/lib/rust-client/sabmonitor-synthetic-scripts';
import { sabmonitorApiTransactionApi } from '@/lib/rust-client/sabmonitor-api-transactions';
import {
    sabmonitorTraceSpanApi,
    type SabmonitorIngestSpanInput,
} from '@/lib/rust-client/sabmonitor-trace-spans';
import { sabmonitorTraceApi } from '@/lib/rust-client/sabmonitor-traces';

import { getProbeRuntime } from '@/lib/sabmonitor/probe';

async function requireUser(): Promise<void> {
    const session = await getSession();
    if (!session?.user) {
        throw new Error('Unauthorized');
    }
}

function revalidateSabmonitor(path?: string): void {
    revalidatePath('/dashboard/sabmonitor');
    if (path) revalidatePath(path);
}

/* ─── Checks ────────────────────────────────────────────────────────── */

export async function listSabmonitorChecks(params?: SabmonitorCheckListParams) {
    await requireUser();
    return sabmonitorCheckApi.list(params);
}
export async function getSabmonitorCheck(id: string) {
    await requireUser();
    return sabmonitorCheckApi.getById(id);
}
export async function createSabmonitorCheck(input: SabmonitorCheckCreateInput) {
    await requireUser();
    const res = await sabmonitorCheckApi.create(input);
    revalidateSabmonitor('/dashboard/sabmonitor/checks');
    return res;
}
export async function updateSabmonitorCheck(
    id: string,
    patch: SabmonitorCheckUpdateInput,
) {
    await requireUser();
    const res = await sabmonitorCheckApi.update(id, patch);
    revalidateSabmonitor(`/dashboard/sabmonitor/checks/${id}`);
    return res;
}
export async function deleteSabmonitorCheck(id: string) {
    await requireUser();
    const res = await sabmonitorCheckApi.delete(id);
    revalidateSabmonitor('/dashboard/sabmonitor/checks');
    return res;
}

/**
 * Runs a check immediately via the configured probe runtime, reports the
 * result through `recordSabmonitorProbeRun`, and returns the synthesized
 * run entity. This is the manual "Run now" button on the check page.
 */
export async function runSabmonitorCheckNow(checkId: string) {
    await requireUser();
    const check = await sabmonitorCheckApi.getById(checkId);
    if (!check || !check._id) {
        throw new Error('Check not found');
    }
    const probe = getProbeRuntime();

    let status: 'up' | 'down' | 'warning' = 'unknown' as never;
    let responseMs = 0;
    let httpStatusCode: number | undefined;
    let sslDaysToExpiry: number | undefined;
    let errorMessage: string | undefined;
    let traceJson: string | undefined;

    if (check.kind === 'synthetic_browser' && check.syntheticScriptId) {
        const script = await sabmonitorSyntheticScriptApi.getById(check.syntheticScriptId);
        if (!script || !script._id) {
            throw new Error('Linked synthetic script not found');
        }
        const r = await probe.runSyntheticScript({
            id: script._id,
            name: script.name,
            stepsJson: script.stepsJson,
            screenshotOnFailure: script.screenshotOnFailure,
        });
        status = r.status;
        responseMs = r.responseMs;
        traceJson = r.traceJson;
        errorMessage = r.errorMessage;
    } else if (check.kind === 'api_transaction' && check.apiTransactionId) {
        const txn = await sabmonitorApiTransactionApi.getById(check.apiTransactionId);
        if (!txn || !txn._id) {
            throw new Error('Linked API transaction not found');
        }
        const r = await probe.runApiTransaction({
            id: txn._id,
            name: txn.name,
            stepsJson: txn.stepsJson,
        });
        status = r.status;
        responseMs = r.responseMs;
        traceJson = r.traceJson;
        errorMessage = r.errorMessage;
    } else {
        const r = await probe.runCheck({
            id: check._id,
            name: check.name,
            kind: check.kind,
            url: check.url,
            host: check.host,
            port: check.port,
            headersJson: check.headersJson,
            bodyJson: check.bodyJson,
            expectedStatus: check.expectedStatus,
            expectedBodyContains: check.expectedBodyContains,
            expectedBodyRegex: check.expectedBodyRegex,
            sslExpiryWarnDays: check.sslExpiryWarnDays,
        });
        status = r.status;
        responseMs = r.responseMs;
        httpStatusCode = r.httpStatusCode;
        sslDaysToExpiry = r.sslDaysToExpiry;
        errorMessage = r.errorMessage;
    }

    const res = await sabmonitorCheckRunApi.report({
        checkId: check._id,
        probeRegion: 'local-mock',
        status,
        responseMs,
        httpStatusCode,
        sslDaysToExpiry,
        errorMessage,
        traceJson,
    });
    revalidateSabmonitor(`/dashboard/sabmonitor/checks/${check._id}`);
    return res;
}

/* ─── Check runs ────────────────────────────────────────────────────── */

export async function listSabmonitorCheckRuns(params?: {
    checkId?: string;
    status?: 'up' | 'down' | 'warning';
    region?: string;
    page?: number;
    limit?: number;
}) {
    await requireUser();
    return sabmonitorCheckRunApi.list(params);
}

/**
 * Probe-token-authenticated ingest entry point. **TODO — auth.**
 *
 * Today this only verifies a user session for parity with the rest of the
 * actions module. The real probe pipeline must hit the Rust endpoint
 * directly with a tenant-scoped probe token (issued by an upcoming
 * `/v1/sabmonitor/probes/exchange-token` flow), bypassing the Next.js
 * server-action layer. Until that lands, **do not** expose this action
 * over the public probe-network surface.
 */
export async function recordSabmonitorProbeRun(args: SabmonitorReportRunInput) {
    await requireUser();
    return sabmonitorCheckRunApi.report(args);
}

/* ─── Incidents ─────────────────────────────────────────────────────── */

export async function listSabmonitorIncidents(params?: Parameters<typeof sabmonitorIncidentApi.list>[0]) {
    await requireUser();
    return sabmonitorIncidentApi.list(params);
}
export async function acknowledgeSabmonitorIncident(id: string) {
    await requireUser();
    const res = await sabmonitorIncidentApi.acknowledge(id);
    revalidateSabmonitor('/dashboard/sabmonitor/incidents');
    return res;
}
export async function resolveSabmonitorIncident(id: string) {
    await requireUser();
    const res = await sabmonitorIncidentApi.resolve(id);
    revalidateSabmonitor('/dashboard/sabmonitor/incidents');
    return res;
}

/* ─── Alert policies ────────────────────────────────────────────────── */

export async function listSabmonitorAlertPolicies() {
    await requireUser();
    return sabmonitorAlertPolicyApi.list();
}
export async function getSabmonitorAlertPolicy(id: string) {
    await requireUser();
    return sabmonitorAlertPolicyApi.getById(id);
}
export async function createSabmonitorAlertPolicy(input: SabmonitorAlertPolicyCreateInput) {
    await requireUser();
    const res = await sabmonitorAlertPolicyApi.create(input);
    revalidateSabmonitor('/dashboard/sabmonitor/alert-policies');
    return res;
}
export async function updateSabmonitorAlertPolicy(
    id: string,
    patch: Partial<SabmonitorAlertPolicyCreateInput>,
) {
    await requireUser();
    const res = await sabmonitorAlertPolicyApi.update(id, patch);
    revalidateSabmonitor(`/dashboard/sabmonitor/alert-policies/${id}`);
    return res;
}
export async function deleteSabmonitorAlertPolicy(id: string) {
    await requireUser();
    const res = await sabmonitorAlertPolicyApi.delete(id);
    revalidateSabmonitor('/dashboard/sabmonitor/alert-policies');
    return res;
}

/* ─── Status pages ──────────────────────────────────────────────────── */

export async function listSabmonitorStatusPages() {
    await requireUser();
    return sabmonitorStatusPageApi.list();
}
export async function getSabmonitorStatusPage(id: string) {
    await requireUser();
    return sabmonitorStatusPageApi.getById(id);
}
export async function createSabmonitorStatusPage(input: SabmonitorStatusPageCreateInput) {
    await requireUser();
    const res = await sabmonitorStatusPageApi.create(input);
    revalidateSabmonitor('/dashboard/sabmonitor/status-pages');
    return res;
}
export async function updateSabmonitorStatusPage(
    id: string,
    patch: Partial<SabmonitorStatusPageCreateInput>,
) {
    await requireUser();
    const res = await sabmonitorStatusPageApi.update(id, patch);
    revalidateSabmonitor(`/dashboard/sabmonitor/status-pages/${id}`);
    return res;
}
export async function deleteSabmonitorStatusPage(id: string) {
    await requireUser();
    const res = await sabmonitorStatusPageApi.delete(id);
    revalidateSabmonitor('/dashboard/sabmonitor/status-pages');
    return res;
}
export async function postSabmonitorStatusPageIncident(
    statusPageId: string,
    args: { title: string; kind: SabmonitorStatusPageIncidentKind; body: string },
) {
    await requireUser();
    const res = await sabmonitorStatusPageIncidentApi.create({
        statusPageId,
        ...args,
    });
    revalidateSabmonitor(`/dashboard/sabmonitor/status-pages/${statusPageId}`);
    return res;
}

/* ─── Synthetic scripts ─────────────────────────────────────────────── */

export async function listSabmonitorSyntheticScripts() {
    await requireUser();
    return sabmonitorSyntheticScriptApi.list();
}
export async function getSabmonitorSyntheticScript(id: string) {
    await requireUser();
    return sabmonitorSyntheticScriptApi.getById(id);
}
export async function createSabmonitorSyntheticScript(input: {
    name: string;
    stepsJson: unknown;
    screenshotOnFailure?: boolean;
}) {
    await requireUser();
    const res = await sabmonitorSyntheticScriptApi.create(input);
    revalidateSabmonitor('/dashboard/sabmonitor/synthetic-scripts');
    return res;
}
export async function updateSabmonitorSyntheticScript(
    id: string,
    patch: { name?: string; stepsJson?: unknown; screenshotOnFailure?: boolean },
) {
    await requireUser();
    const res = await sabmonitorSyntheticScriptApi.update(id, patch);
    revalidateSabmonitor(`/dashboard/sabmonitor/synthetic-scripts/${id}`);
    return res;
}
export async function deleteSabmonitorSyntheticScript(id: string) {
    await requireUser();
    const res = await sabmonitorSyntheticScriptApi.delete(id);
    revalidateSabmonitor('/dashboard/sabmonitor/synthetic-scripts');
    return res;
}

/* ─── API transactions ──────────────────────────────────────────────── */

export async function listSabmonitorApiTransactions() {
    await requireUser();
    return sabmonitorApiTransactionApi.list();
}
export async function getSabmonitorApiTransaction(id: string) {
    await requireUser();
    return sabmonitorApiTransactionApi.getById(id);
}
export async function createSabmonitorApiTransaction(input: { name: string; stepsJson: unknown }) {
    await requireUser();
    const res = await sabmonitorApiTransactionApi.create(input);
    revalidateSabmonitor('/dashboard/sabmonitor/api-transactions');
    return res;
}
export async function updateSabmonitorApiTransaction(
    id: string,
    patch: { name?: string; stepsJson?: unknown },
) {
    await requireUser();
    const res = await sabmonitorApiTransactionApi.update(id, patch);
    revalidateSabmonitor(`/dashboard/sabmonitor/api-transactions/${id}`);
    return res;
}
export async function deleteSabmonitorApiTransaction(id: string) {
    await requireUser();
    const res = await sabmonitorApiTransactionApi.delete(id);
    revalidateSabmonitor('/dashboard/sabmonitor/api-transactions');
    return res;
}

/* ─── Probes ────────────────────────────────────────────────────────── */

export async function listSabmonitorProbes(params?: Parameters<typeof sabmonitorProbeApi.list>[0]) {
    await requireUser();
    return sabmonitorProbeApi.list(params);
}
export async function createSabmonitorProbe(input: SabmonitorProbeCreateInput) {
    await requireUser();
    const res = await sabmonitorProbeApi.create(input);
    revalidateSabmonitor('/dashboard/sabmonitor/probes');
    return res;
}
export async function updateSabmonitorProbe(id: string, patch: SabmonitorProbeUpdateInput) {
    await requireUser();
    const res = await sabmonitorProbeApi.update(id, patch);
    revalidateSabmonitor('/dashboard/sabmonitor/probes');
    return res;
}
export async function deleteSabmonitorProbe(id: string) {
    await requireUser();
    const res = await sabmonitorProbeApi.delete(id);
    revalidateSabmonitor('/dashboard/sabmonitor/probes');
    return res;
}

/* ─── APM traces ────────────────────────────────────────────────────── */

export async function listSabmonitorTraces(params?: Parameters<typeof sabmonitorTraceApi.list>[0]) {
    await requireUser();
    return sabmonitorTraceApi.list(params);
}
export async function getSabmonitorTrace(traceId: string) {
    await requireUser();
    return sabmonitorTraceApi.getByTraceId(traceId);
}
export async function listSabmonitorTraceSpans(params?: Parameters<typeof sabmonitorTraceSpanApi.list>[0]) {
    await requireUser();
    return sabmonitorTraceSpanApi.list(params);
}

/**
 * Trace-token-authenticated ingest entry point. **TODO — auth.**
 *
 * Same shape as `recordSabmonitorProbeRun` — production trace ingest must
 * skip the Next.js server-action layer and hit the Rust handler with a
 * tenant-scoped trace token. Real OTLP-format conversion happens at the
 * edge of the trace pipeline, not here.
 */
export async function ingestSabmonitorTraceSpan(args: SabmonitorIngestSpanInput) {
    await requireUser();
    return sabmonitorTraceSpanApi.ingest(args);
}
