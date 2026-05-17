/**
 * Thin runtime bridge to the Vercel Workflow DevKit.
 *
 * The engine never imports `workflow/api` directly — it goes through this
 * file. That gives us two wins:
 *
 *  1. The rest of the codebase compiles even when the `workflow` package
 *     hasn't been `npm install`-ed yet. (See `docs/ops/automations-engine.md`
 *     for the install command.)
 *
 *  2. We have one place to record the "Workflow DevKit not installed"
 *     fallback path so ops can spot it in `crm_automation_runs`.
 *
 * Once `workflow` + `@workflow/next` are installed the implementation
 * inside `tryStartWorkflow` automatically resolves the real
 * `workflow/api#start` and dispatches durably. No other call site needs
 * to change.
 */

export interface StartWorkflowResult {
    runId: string;
    /** True when the real Workflow DevKit handled the dispatch. */
    durable: boolean;
}

/**
 * Calls `start()` from `workflow/api` to register a durable run and get
 * a runId back. If the package isn't installed, logs a structured
 * warning and returns `{ durable: false, runId: '' }` so the dispatcher
 * can record the fallback in `crm_automation_runs`.
 *
 * NOTE: We use a dynamic import string with `Function('return import(...)')`
 * so static analysis (TS, esbuild) does NOT try to resolve `workflow/api`
 * at build time. This is intentional — the module is optional today and
 * will be hard-required once `npm install workflow @workflow/next` runs.
 */
export async function startAutomationRun(
    workflowName: string,
    args: unknown[],
): Promise<StartWorkflowResult> {
    try {
        // The workflow file lives at `src/workflows/automation-run.ts` and
        // exports `runAutomation`. We pass that function reference through
        // a module loader the Workflow runtime registers at boot.
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
        const dynamicImport = new Function(
            'm',
            'return import(m)',
        ) as (m: string) => Promise<Record<string, unknown>>;

        const api = (await dynamicImport('workflow/api')) as {
            start?: (
                fn: unknown,
                args: unknown[],
            ) => Promise<{ runId: string }>;
        };
        const workflowMod = (await dynamicImport(
            '@/workflows/automation-run',
        )) as Record<string, unknown>;

        const fn = workflowMod[workflowName];
        if (typeof api.start !== 'function' || typeof fn !== 'function') {
            console.warn(
                '[automations] workflow-runtime: workflow/api.start or workflow fn missing',
                { workflowName },
            );
            return { runId: '', durable: false };
        }

        const run = await api.start(fn, args);
        return { runId: run.runId, durable: true };
    } catch (e) {
        // Most common reason: package not installed yet.
        console.warn(
            '[automations] workflow-runtime: Workflow DevKit unavailable — '
                + 'run will not be durably enqueued. Install `workflow` and '
                + '`@workflow/next` to enable durable execution.',
            { workflowName, error: (e as Error).message },
        );
        return { runId: '', durable: false };
    }
}
