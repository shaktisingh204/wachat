import type { Block, NodeRetryConfig, NodeErrorStrategy } from '@/lib/sabflow/types';

export type NodeRunOutcome<T> =
  | { kind: 'ok'; value: T; attempts: number; pinned?: boolean }
  | { kind: 'error'; error: Error; attempts: number; strategy: NodeErrorStrategy };

type RunOpts = {
  /** Called before each retry-sleep so callers can emit a log entry. */
  onRetry?: (attempt: number, waitMs: number, error: Error) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeWait(retry: NodeRetryConfig, attempt: number): number {
  const base = Math.max(0, retry.waitMs ?? 1000);
  if (retry.backoff === 'exponential') {
    return base * 2 ** Math.max(0, attempt - 1);
  }
  return base;
}

/**
 * Runs a node's execution fn with n8n-style retry + error handling.
 *
 *  - If `block.pinData` is set, `fn` is never called. The pinned value is
 *    returned immediately as `{ kind: 'ok', pinned: true, attempts: 0 }`.
 *  - Otherwise `fn` is invoked up to `retry.maxTries` times. Successful calls
 *    short-circuit. The last error is wrapped into the outcome when all
 *    retries fail.
 *  - The returned `strategy` field reflects the node's `onError` setting so
 *    the caller can decide whether to stop, continue on main, or route to
 *    the error pin.
 *
 * No output-routing decisions happen here — this is a pure wrapper.
 */
export async function runWithRetry<T>(
  block: Block,
  fn: () => Promise<T> | T,
  opts: RunOpts = {},
): Promise<NodeRunOutcome<T>> {
  if (block.pinData !== undefined) {
    return { kind: 'ok', value: block.pinData as T, attempts: 0, pinned: true };
  }

  const retry = block.retry;
  const maxTries = Math.max(1, retry?.maxTries ?? 1);
  const strategy: NodeErrorStrategy = block.onError ?? 'stop';

  let lastError: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    try {
      const value = await fn();
      return { kind: 'ok', value, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxTries && retry) {
        const waitMs = computeWait(retry, attempt);
        opts.onRetry?.(attempt, waitMs, lastError);
        if (waitMs > 0) await sleep(waitMs);
      }
    }
  }

  return { kind: 'error', error: lastError, attempts: maxTries, strategy };
}
