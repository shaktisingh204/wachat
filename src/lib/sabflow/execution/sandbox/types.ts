/**
 * Sandbox type contracts.
 *
 * These types are shared by the server-side (Node `vm`) sandbox and the
 * client-side (hidden `<iframe>`) sandbox so that callers can swap the
 * two implementations transparently via `runScript()`.
 */

/**
 * The execution context exposed *inside* the sandbox.
 *
 * Only these properties are visible to user code. No globals from the host
 * environment (no `process`, `require`, `global`, `window`, `document`,
 * `Buffer`, `eval`, …) ever leak through this object.
 */
export type SandboxContext = {
  /** Snapshot of flow variables (values may be strings, numbers, booleans, objects, …). */
  variables: Record<string, unknown>;
  /** Schedules a variable mutation. The change is returned to the caller via SandboxResult. */
  setVariable: (name: string, value: unknown) => void;
  /**
   * Optional `fetch` — only injected when `options.allowFetch` is true.
   *
   * SECURITY: On the server we wrap the real fetch with a domain whitelist.
   * On the client we rely on the iframe's same-origin policy + our whitelist.
   */
  fetch?: typeof fetch;
  /** Minimal console shim that forwards to our log buffer (not to the host stdout). */
  console: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
};

/** A single log line captured during script execution. */
export type SandboxLogEntry = {
  level: 'log' | 'error';
  message: string;
};

/** The normalized outcome of running a user script. */
export type SandboxResult = {
  /** True when the script ran to completion without throwing. */
  success: boolean;
  /** The value returned by the script (when `success === true`). */
  returnValue?: unknown;
  /** Mutated variables map — only variables that were set via `setVariable`. */
  variables?: Record<string, unknown>;
  /** Console output captured inside the sandbox. */
  logs: SandboxLogEntry[];
  /** Error message + stack when `success === false`. */
  error?: string;
  /** Wall-clock execution time in milliseconds. */
  executionTimeMs: number;
};

/** Options controlling sandbox behaviour and resource limits. */
export type SandboxOptions = {
  /** Hard timeout in milliseconds. Default 5000. */
  timeoutMs?: number;
  /** Whether to inject a `fetch` binding. Default false. */
  allowFetch?: boolean;
  /** When `allowFetch` is true, limit requests to these hostnames. Empty → deny-all. */
  allowedDomains?: string[];
};

/** Internal wire format used between the iframe worker and the host page. */
export type SandboxMessage =
  | {
      type: 'sabflow-sandbox-init';
      id: string;
      code: string;
      variables: Record<string, unknown>;
      allowFetch: boolean;
      allowedDomains: string[];
      timeoutMs: number;
    }
  | {
      type: 'sabflow-sandbox-result';
      id: string;
      result: SandboxResult;
    };
