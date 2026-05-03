/**
 * Synthetic check runner.
 *
 * Supports four check kinds:
 *   - http     : performs an HTTP request via global `fetch` and validates
 *                status / body assertions.
 *   - dns      : resolves a hostname via `node:dns/promises`.
 *   - tcp      : opens a raw TCP socket via `node:net`.
 *   - browser  : runs a scripted puppeteer flow (skeleton — actual launch is
 *                deferred behind a dynamic import so the module can be loaded
 *                in environments without puppeteer installed at runtime).
 *
 * The runner is best-effort and never throws: every code path returns a
 * `SyntheticResult` with `success: false` and a populated `error` field so
 * callers can build histograms / SLOs from the result stream uniformly.
 */

import type { BrowserStep, SyntheticCheck, SyntheticResult } from './types';

const DEFAULT_TIMEOUT_MS = 10_000;

/** Run a synthetic check and always return a result object. */
export async function runCheck(check: SyntheticCheck, now: number = Date.now()): Promise<SyntheticResult> {
    const startedAt = now;
    try {
        switch (check.type) {
            case 'http':
                return await runHttp(check, startedAt);
            case 'dns':
                return await runDns(check, startedAt);
            case 'tcp':
                return await runTcp(check, startedAt);
            case 'browser':
                return await runBrowser(check, startedAt);
            default: {
                const exhaustive: never = check.type;
                return failResult(check, startedAt, `unsupported check type: ${String(exhaustive)}`);
            }
        }
    } catch (err) {
        return failResult(check, startedAt, errorMessage(err));
    }
}

function failResult(check: SyntheticCheck, startedAt: number, error: string): SyntheticResult {
    return {
        checkId: check.id,
        runAt: startedAt,
        success: false,
        durationMs: Math.max(0, Date.now() - startedAt),
        error,
    };
}

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    try {
        return JSON.stringify(err);
    } catch {
        return 'unknown error';
    }
}

async function runHttp(check: SyntheticCheck, startedAt: number): Promise<SyntheticResult> {
    const timeoutMs = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(check.target, {
            method: check.http?.method ?? 'GET',
            headers: check.http?.headers,
            body: check.http?.body,
            signal: controller.signal,
        });

        const expectedStatus = check.http?.expectedStatus;
        const statusOk =
            expectedStatus === undefined
                ? response.ok
                : Array.isArray(expectedStatus)
                  ? expectedStatus.includes(response.status)
                  : response.status === expectedStatus;

        let bodyOk = true;
        let bodyText: string | undefined;
        if (check.http?.expectedBody !== undefined) {
            bodyText = await response.text();
            const expected = check.http.expectedBody;
            bodyOk =
                typeof expected === 'string' ? bodyText.includes(expected) : (expected as RegExp).test(bodyText);
        }

        const success = statusOk && bodyOk;
        return {
            checkId: check.id,
            runAt: startedAt,
            success,
            durationMs: Date.now() - startedAt,
            error: success ? undefined : `assertion failed (status=${response.status}, bodyOk=${bodyOk})`,
            details: { status: response.status, statusOk, bodyOk, bodySnippet: bodyText?.slice(0, 256) },
        };
    } finally {
        clearTimeout(timer);
    }
}

async function runDns(check: SyntheticCheck, startedAt: number): Promise<SyntheticResult> {
    const dns = await import('node:dns/promises');
    const recordType = check.dns?.recordType ?? 'A';
    const records = await dns.resolve(check.target, recordType);
    const expected = check.dns?.expectedAnswer;
    const flat = (records as unknown[]).map((r) => (typeof r === 'string' ? r : JSON.stringify(r)));
    const success = expected ? flat.includes(expected) : flat.length > 0;
    return {
        checkId: check.id,
        runAt: startedAt,
        success,
        durationMs: Date.now() - startedAt,
        error: success ? undefined : `expected ${expected} but got ${flat.join(',') || 'none'}`,
        details: { records: flat },
    };
}

async function runTcp(check: SyntheticCheck, startedAt: number): Promise<SyntheticResult> {
    const net = await import('node:net');
    const [host, portStr] = check.target.split(':');
    const port = Number(portStr);
    if (!host || !Number.isFinite(port)) {
        return failResult(check, startedAt, `invalid tcp target: ${check.target}`);
    }
    const timeoutMs = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return await new Promise<SyntheticResult>((resolve) => {
        const socket = new net.Socket();
        let settled = false;
        const finish = (success: boolean, error?: string) => {
            if (settled) return;
            settled = true;
            try {
                socket.destroy();
            } catch {
                /* noop */
            }
            resolve({
                checkId: check.id,
                runAt: startedAt,
                success,
                durationMs: Date.now() - startedAt,
                error,
                details: { host, port },
            });
        };
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false, 'tcp connect timed out'));
        socket.once('error', (err: Error) => finish(false, err.message));
        socket.connect(port, host);
    });
}

/**
 * Browser-flow runner — skeleton.
 *
 * The actual puppeteer wiring is intentionally minimal: it loads puppeteer
 * lazily so this file can be imported in environments where puppeteer isn't
 * available. Each `BrowserStep` is executed sequentially. If puppeteer can't
 * be resolved we return a structured failure rather than throwing.
 */
async function runBrowser(check: SyntheticCheck, startedAt: number): Promise<SyntheticResult> {
    let puppeteer: typeof import('puppeteer') | undefined;
    try {
        // eslint-disable-next-line @typescript-eslint/consistent-type-imports
        puppeteer = (await import('puppeteer')) as typeof import('puppeteer');
    } catch {
        return failResult(check, startedAt, 'puppeteer not available in this environment');
    }

    const flow = check.flow ?? [];
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        for (const step of flow) {
            await runBrowserStep(page, step);
        }
        return {
            checkId: check.id,
            runAt: startedAt,
            success: true,
            durationMs: Date.now() - startedAt,
            details: { steps: flow.length },
        };
    } catch (err) {
        return failResult(check, startedAt, errorMessage(err));
    } finally {
        await browser.close().catch(() => undefined);
    }
}

async function runBrowserStep(page: { goto: Function; click: Function; type: Function; waitForSelector: Function; $eval: Function }, step: BrowserStep): Promise<void> {
    switch (step.action) {
        case 'goto':
            await page.goto(step.url ?? '', { timeout: step.timeoutMs ?? DEFAULT_TIMEOUT_MS });
            return;
        case 'click':
            await page.click(step.selector ?? '');
            return;
        case 'type':
            await page.type(step.selector ?? '', step.value ?? '');
            return;
        case 'waitFor':
            await page.waitForSelector(step.selector ?? '', { timeout: step.timeoutMs ?? DEFAULT_TIMEOUT_MS });
            return;
        case 'assertText': {
            const text = (await page.$eval(step.selector ?? '', (el: { textContent: string | null }) => el.textContent ?? '')) as string;
            if (!text.includes(step.value ?? '')) {
                throw new Error(`assertText failed for ${step.selector}`);
            }
            return;
        }
    }
}
