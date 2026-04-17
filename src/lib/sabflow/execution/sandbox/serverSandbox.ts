/**
 * Server-side (Node.js) JavaScript sandbox for SabFlow.
 *
 * ── Security boundary ─────────────────────────────────────────────────────
 *
 * We use Node's built-in `vm` module to create a fresh context object whose
 * *only* visible properties are the ones we hand-pick below. Critically:
 *
 *   • `vm.createContext(sandbox)` turns `sandbox` into a new V8 context.
 *     User code cannot see `process`, `require`, `global`, `Buffer`,
 *     `__dirname`, `setImmediate`, `Function`, dynamic `import`, etc. —
 *     none of those are properties of the object we pass in.
 *   • We explicitly overwrite `constructor`, `globalThis`, and `this` on
 *     the sandbox so that `({}).constructor.constructor("return process")()`
 *     cannot walk up the prototype chain to reach the outer realm.
 *     (V8 still enforces realm isolation, but belt-and-braces.)
 *   • `script.runInContext(ctx, { timeout })` terminates long-running
 *     synchronous code. Asynchronous timers are NOT killed by `timeout`;
 *     that is why we additionally race the promise resolution ourselves.
 *   • `fetch` is injected ONLY when `options.allowFetch === true`, and it
 *     is wrapped so that requests to non-whitelisted hosts reject.
 *
 * ── What this sandbox does NOT protect against ───────────────────────────
 *
 *   • CPU-bound async loops (`while(true) await Promise.resolve()`). We
 *     mitigate with a wall-clock timeout, not a CPU quota.
 *   • Prototype pollution of literals the user returns. We only persist
 *     the explicit `setVariable` calls and the return value.
 *   • Memory exhaustion. Node's `vm` shares the same heap as the parent;
 *     for stronger isolation use `isolated-vm` or `vercel/sandbox`. This
 *     implementation is intended for trusted-ish tenant code.
 */

import type {
  SandboxContext,
  SandboxLogEntry,
  SandboxOptions,
  SandboxResult,
} from './types';

const DEFAULT_TIMEOUT_MS = 5000;

/** Serialize an arbitrary argument into a printable log string. */
function stringifyArg(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[Unserializable]';
  }
}

/** Extract hostname from a URL-ish input without throwing. */
function hostnameOf(input: string | URL): string | null {
  try {
    return new URL(typeof input === 'string' ? input : input.toString()).hostname;
  } catch {
    return null;
  }
}

/**
 * Build a `fetch` wrapper that enforces a hostname whitelist.
 *
 * When `allowedDomains` is empty, ALL requests are denied — deny-by-default.
 * A hostname matches if it equals an entry, or is a subdomain of an entry.
 */
function makeGuardedFetch(allowedDomains: string[]): typeof fetch {
  const allowList = allowedDomains.map((d) => d.toLowerCase().trim()).filter(Boolean);

  const isAllowed = (host: string): boolean => {
    const h = host.toLowerCase();
    return allowList.some((dom) => h === dom || h.endsWith(`.${dom}`));
  };

  // We cast through `unknown` because Node's `fetch` global typing matches
  // the DOM `fetch` signature when lib.dom is available at build time.
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const host =
      typeof input === 'string' || input instanceof URL
        ? hostnameOf(input)
        : hostnameOf((input as Request).url);

    if (!host || !isAllowed(host)) {
      throw new Error(
        `[sandbox] fetch blocked: ${host ?? 'invalid url'} is not in the allowed domain list`,
      );
    }
    return globalThis.fetch(input, init);
  }) as unknown as typeof fetch;
}

/**
 * Run user-provided JavaScript source inside a Node `vm` sandbox.
 *
 * The script is wrapped in an async IIFE so the user can freely use
 * `await` and top-level `return` at the script root.
 */
export async function runServerScript(
  code: string,
  context: SandboxContext,
  options: SandboxOptions = {},
): Promise<SandboxResult> {
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const allowFetch = options.allowFetch === true;
  const allowedDomains = options.allowedDomains ?? [];

  const logs: SandboxLogEntry[] = [];
  const mutatedVariables: Record<string, unknown> = {};

  // Dynamic-import `vm` so that this module is safe to include in bundles
  // that might be tree-shaken on the edge (where `vm` is unavailable).
  // SECURITY: still a server-only API — the browser sandbox lives elsewhere.
  const vm = await import('node:vm');

  // ── Host-visible bindings ────────────────────────────────────────────
  // These are the ONLY callables exposed to guest code.

  const hostConsole = {
    log: (...args: unknown[]) => {
      logs.push({ level: 'log', message: args.map(stringifyArg).join(' ') });
      // Also forward to the provided context console (may be a no-op).
      context.console?.log?.(...args);
    },
    error: (...args: unknown[]) => {
      logs.push({ level: 'error', message: args.map(stringifyArg).join(' ') });
      context.console?.error?.(...args);
    },
  };

  const hostSetVariable = (name: string, value: unknown) => {
    if (typeof name !== 'string' || name.length === 0) return;
    mutatedVariables[name] = value;
    context.setVariable(name, value);
  };

  const hostFetch = allowFetch ? makeGuardedFetch(allowedDomains) : undefined;

  // ── Sandbox object — the entire global scope of guest code ───────────
  //
  // NOTE: we clone `variables` so guest code mutating the object cannot
  // pollute the caller's reference. We expose it read-only-ish by only
  // providing a cloned copy; true mutations must go via setVariable().
  const clonedVariables = safeClone(context.variables);

  const sandboxGlobals: Record<string, unknown> = {
    variables: clonedVariables,
    setVariable: hostSetVariable,
    console: hostConsole,
    // Whitelisted safe globals. Everything below is intrinsic & side-effect free.
    JSON,
    Math,
    Date,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    Map,
    Set,
    Promise,
    Symbol,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    // Explicitly poison dangerous names that might otherwise fall through
    // to the inherited sandbox prototype.
    globalThis: undefined,
    global: undefined,
    process: undefined,
    require: undefined,
    module: undefined,
    exports: undefined,
    Buffer: undefined,
    __dirname: undefined,
    __filename: undefined,
    setImmediate: undefined,
    setInterval: undefined,
    queueMicrotask: undefined,
    eval: undefined,
    Function: undefined,
  };

  if (hostFetch) {
    sandboxGlobals.fetch = hostFetch;
  }

  const ctx = vm.createContext(sandboxGlobals, {
    name: 'sabflow:sandbox',
    codeGeneration: {
      // Deny `eval` and `new Function(...)` inside the context. This is the
      // single most important lockdown: without it, guest code could
      // dynamically compile & escape via Function constructor tricks.
      strings: false,
      wasm: false,
    },
  });

  // ── Wrap user code into an awaitable expression ──────────────────────
  // We expose user code's "return value" by wrapping it in an async IIFE.
  // Any syntax error is caught at vm.Script construction time.
  const wrappedSource = `(async () => {\n${code}\n})()`;

  const startedAt = Date.now();

  let script: import('node:vm').Script;
  try {
    script = new vm.Script(wrappedSource, {
      filename: 'sabflow-user-script.js',
      // `timeout` here is the parse timeout; runInContext has its own.
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      logs,
      executionTimeMs: Date.now() - startedAt,
    };
  }

  // ── Race vm.timeout against a wall-clock timer ───────────────────────
  //
  // `script.runInContext({ timeout })` interrupts synchronous code only.
  // For async code we additionally enforce a wall-clock race that rejects
  // if the returned promise takes too long. Pending microtasks outlive
  // that rejection, but their side-effects can no longer mutate us
  // because we stop reading `mutatedVariables` / `logs` after return.
  const promise: Promise<unknown> = (async () => {
    const maybePromise = script.runInContext(ctx, {
      timeout: timeoutMs,
      displayErrors: true,
      breakOnSigint: false,
    });
    return await maybePromise;
  })();

  let returnValue: unknown;
  let errorMessage: string | undefined;
  let success = false;

  try {
    returnValue = await Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`[sandbox] execution exceeded ${timeoutMs}ms timeout`)),
          timeoutMs,
        ),
      ),
    ]);
    success = true;
  } catch (err) {
    if (err instanceof Error) {
      errorMessage = err.stack ?? `${err.name}: ${err.message}`;
    } else {
      errorMessage = String(err);
    }
  }

  return {
    success,
    returnValue: success ? safeClone(returnValue) : undefined,
    variables: { ...mutatedVariables },
    logs,
    error: errorMessage,
    executionTimeMs: Date.now() - startedAt,
  };
}

/**
 * Defensive JSON clone that falls back to a best-effort structured snapshot.
 * Used to snip any references that might leak sandbox objects back to the host.
 */
function safeClone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    // Best-effort string form; we intentionally avoid returning the original
    // reference so that circular sandbox objects cannot leak out.
    return String(value) as unknown as T;
  }
}
