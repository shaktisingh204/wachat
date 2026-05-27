/**
 * SabMonitor probe runtime abstraction.
 *
 * `IProbeRuntime` is the seam between SabMonitor's stored check
 * configuration and whatever actually performs the probe — a local PM2
 * worker, a Vercel-edge-cron synthetic agent, or a fleet of regional
 * probe processes.
 *
 * For the first cut SabNode ships `MockProbe` only: deterministic results
 * that the UI can render so the surface stays usable while real probes
 * are wired up.
 */

import 'server-only';

/* ─── Wire shapes (kept small + framework-free) ────────────────────── */

export type CheckKind =
    | 'http'
    | 'tcp'
    | 'dns'
    | 'ssl'
    | 'ping'
    | 'synthetic_browser'
    | 'api_transaction';

export type CheckStatus = 'up' | 'down' | 'warning';

export interface ProbeCheckInput {
    id: string;
    name: string;
    kind: CheckKind;
    url?: string;
    host?: string;
    port?: number;
    headersJson?: string;
    bodyJson?: string;
    expectedStatus?: number;
    expectedBodyContains?: string;
    expectedBodyRegex?: string;
    sslExpiryWarnDays?: number;
}

export interface ProbeCheckResult {
    status: CheckStatus;
    responseMs: number;
    httpStatusCode?: number;
    sslDaysToExpiry?: number;
    errorMessage?: string;
}

export interface ProbeSyntheticScriptInput {
    id: string;
    name: string;
    stepsJson: unknown;
    screenshotOnFailure: boolean;
}

export interface ProbeSyntheticScriptResult {
    status: CheckStatus;
    responseMs: number;
    traceJson: string;
    errorMessage?: string;
    /** SabFiles ref to a captured failure screenshot, when applicable. */
    failureScreenshotSabFileId?: string;
}

export interface ProbeApiTxnInput {
    id: string;
    name: string;
    stepsJson: unknown;
}

export interface ProbeApiTxnResult {
    status: CheckStatus;
    responseMs: number;
    traceJson: string;
    errorMessage?: string;
}

/**
 * Probe runtime interface. The concrete implementation chosen at boot
 * time depends on deployment topology (PM2 worker, Vercel cron, external
 * fleet, etc.).
 */
export interface IProbeRuntime {
    runCheck(check: ProbeCheckInput): Promise<ProbeCheckResult>;
    runSyntheticScript(script: ProbeSyntheticScriptInput): Promise<ProbeSyntheticScriptResult>;
    runApiTransaction(txn: ProbeApiTxnInput): Promise<ProbeApiTxnResult>;
}

/* ─── MockProbe ────────────────────────────────────────────────────── */

/**
 * Deterministic stub probe. Hash the input id into a 0–1 number, then
 * pick a status from `up/down/warning` so the UI gets a stable mix
 * across reloads.
 */
function hash01(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    // Reduce to [0, 1)
    return ((h >>> 0) % 1_000) / 1_000;
}

function pickStatus(seed: string): CheckStatus {
    const v = hash01(seed);
    if (v < 0.08) return 'down';
    if (v < 0.18) return 'warning';
    return 'up';
}

export class MockProbe implements IProbeRuntime {
    async runCheck(check: ProbeCheckInput): Promise<ProbeCheckResult> {
        const status = pickStatus(`${check.id}:check`);
        const baseMs = 80 + Math.floor(hash01(check.id) * 900);
        const httpStatusCode =
            status === 'up' ? 200 : status === 'warning' ? 200 : 503;
        return {
            status,
            responseMs: baseMs,
            httpStatusCode: check.kind === 'http' ? httpStatusCode : undefined,
            sslDaysToExpiry:
                check.kind === 'ssl' ? Math.floor(hash01(check.id) * 365) : undefined,
            errorMessage: status === 'down' ? 'mock: connection refused' : undefined,
        };
    }

    async runSyntheticScript(
        script: ProbeSyntheticScriptInput,
    ): Promise<ProbeSyntheticScriptResult> {
        const status = pickStatus(`${script.id}:synthetic`);
        const ms = 1_200 + Math.floor(hash01(script.id) * 4_000);
        return {
            status,
            responseMs: ms,
            traceJson: JSON.stringify({
                steps: [
                    { kind: 'navigate', ms: 320, ok: true },
                    { kind: 'click', ms: 110, ok: true },
                    { kind: 'assert', ms: 80, ok: status === 'up' },
                ],
            }),
            errorMessage: status === 'down' ? 'mock: assertion failed' : undefined,
        };
    }

    async runApiTransaction(txn: ProbeApiTxnInput): Promise<ProbeApiTxnResult> {
        const status = pickStatus(`${txn.id}:api`);
        const ms = 200 + Math.floor(hash01(txn.id) * 1_200);
        return {
            status,
            responseMs: ms,
            traceJson: JSON.stringify({
                steps: [
                    { kind: 'http_request', ms: 90, ok: true, status: 200 },
                    { kind: 'extract', ms: 4, ok: true },
                    { kind: 'assert', ms: 2, ok: status === 'up' },
                ],
            }),
            errorMessage: status === 'down' ? 'mock: response assertion failed' : undefined,
        };
    }
}

/** Singleton accessor. Real probe wiring will replace this. */
let _runtime: IProbeRuntime | null = null;
export function getProbeRuntime(): IProbeRuntime {
    if (!_runtime) _runtime = new MockProbe();
    return _runtime;
}
