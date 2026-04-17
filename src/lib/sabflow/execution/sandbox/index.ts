/**
 * Unified sandbox entry point.
 *
 * Picks the correct implementation based on the current JS environment:
 *
 *   • Node.js  → `runServerScript` (uses `node:vm` + timeouts + fetch guard)
 *   • Browser  → `runBrowserScript` (uses hidden sandboxed iframe)
 *
 * Callers should always import from `@/lib/sabflow/execution/sandbox` and
 * never from the two concrete modules directly, so bundlers can tree-shake
 * the server implementation out of client bundles.
 */

export type {
  SandboxContext,
  SandboxOptions,
  SandboxResult,
  SandboxLogEntry,
  SandboxMessage,
} from './types';

import type { SandboxContext, SandboxOptions, SandboxResult } from './types';

/** True if we are running in a Node.js process (not the browser). */
function isNodeEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    typeof process.versions.node === 'string' &&
    // Window undefined → not a browser.
    typeof window === 'undefined'
  );
}

/**
 * Run a user-provided JavaScript snippet inside the platform-appropriate
 * sandbox.
 *
 * SECURITY: both implementations enforce:
 *   - no access to the host global scope (no `process`, `require`, `window`, …)
 *   - wall-clock timeout
 *   - optional fetch with a hostname whitelist
 *
 * See `./serverSandbox.ts` and `./browserSandbox.ts` for the full per-impl
 * security notes.
 */
export async function runScript(
  code: string,
  context: SandboxContext,
  options: SandboxOptions = {},
): Promise<SandboxResult> {
  if (isNodeEnvironment()) {
    const { runServerScript } = await import('./serverSandbox');
    return runServerScript(code, context, options);
  }
  const { runBrowserScript } = await import('./browserSandbox');
  return runBrowserScript(code, context, options);
}

export { runServerScript } from './serverSandbox';
export { runBrowserScript } from './browserSandbox';
