/**
 * SabCatalyst function-executor interface.
 *
 * The interface abstracts over the actual code runtime (Docker, Firecracker,
 * AWS Lambda, Cloudflare Workers, etc.). The default ships a `MockExecutor`
 * that returns deterministic stub responses so the dashboard + runtime route
 * are fully wired end-to-end before the real container runtime lands.
 *
 * Wiring TODO: swap `MockExecutor` for a real implementation once the
 * isolate runtime is chosen — keep the same interface so no UI / actions
 * code has to change.
 */
import 'server-only';

import type { SabcatalystFunction } from '@/lib/rust-client/sabcatalyst-functions';
import type {
    InvocationStatus,
    SabcatalystFunctionInvocation,
} from '@/lib/rust-client/sabcatalyst-function-invocations';

export interface DeployFunctionArgs {
    func: SabcatalystFunction;
    /** SabFiles file id of the uploaded ZIP. */
    codeBlobFileId: string;
}

export interface DeployFunctionResult {
    ok: boolean;
    deploymentId: string;
    deployedAt: string;
    message?: string;
}

export interface InvokeHttpArgs {
    func: SabcatalystFunction;
    method: string;
    path: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    bodyText: string;
    /** Source IP (forwarded from the runtime route). */
    sourceIp?: string;
}

export interface InvokeHttpResult {
    status: number;
    headers: Record<string, string>;
    bodyText: string;
    durationMs: number;
    billableMs: number;
    invocationStatus: InvocationStatus;
    errorMessage?: string;
}

export interface InvokeCronArgs {
    func: SabcatalystFunction;
    scheduledFor: Date;
}

export interface InvokeCronResult {
    invocationStatus: InvocationStatus;
    durationMs: number;
    billableMs: number;
    errorMessage?: string;
}

export interface IFunctionExecutor {
    deployFunction(args: DeployFunctionArgs): Promise<DeployFunctionResult>;
    invokeHttp(args: InvokeHttpArgs): Promise<InvokeHttpResult>;
    invokeCron(args: InvokeCronArgs): Promise<InvokeCronResult>;
    getInvocationLogs(
        functionId: string,
        limit: number,
    ): Promise<SabcatalystFunctionInvocation[]>;
}

/* ─── Mock implementation ─────────────────────────────────────────── */

/** Returns deterministic stubbed responses so the rest of the stack
 *  can be wired and tested before a real runtime exists. */
export class MockExecutor implements IFunctionExecutor {
    async deployFunction(args: DeployFunctionArgs): Promise<DeployFunctionResult> {
        return {
            ok: true,
            deploymentId: `mock-deploy-${args.func._id}-${Date.now()}`,
            deployedAt: new Date().toISOString(),
            message: 'Mock deploy — no real runtime attached.',
        };
    }

    async invokeHttp(args: InvokeHttpArgs): Promise<InvokeHttpResult> {
        const payload = {
            executed: true,
            mocked: true,
            functionName: args.func.name,
            method: args.method,
            path: args.path,
            receivedQuery: args.query,
            receivedBodyBytes: args.bodyText.length,
        };
        const body = JSON.stringify(payload);
        return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            bodyText: body,
            durationMs: 12,
            billableMs: 12,
            invocationStatus: 'success',
        };
    }

    async invokeCron(_args: InvokeCronArgs): Promise<InvokeCronResult> {
        return {
            invocationStatus: 'success',
            durationMs: 8,
            billableMs: 8,
        };
    }

    async getInvocationLogs(
        _functionId: string,
        _limit: number,
    ): Promise<SabcatalystFunctionInvocation[]> {
        // Real invocations are persisted via the rust-client; the mock
        // returns an empty array so the UI falls back to the Rust list.
        return [];
    }
}

/* ─── Singleton accessor ──────────────────────────────────────────── */

let cached: IFunctionExecutor | null = null;

/**
 * Resolve the active executor for this process. Today this always
 * returns `MockExecutor`. When a real runtime ships, gate the selection
 * on `process.env.SABCATALYST_RUNTIME` and return that implementation
 * instead.
 */
export function getFunctionExecutor(): IFunctionExecutor {
    if (cached) return cached;
    cached = new MockExecutor();
    return cached;
}
