/**
 * Chaos primitives for load tests.
 *
 * These are intentionally lightweight, deterministic-ish helpers that wrap a
 * function (or fetch-style call) with controlled failure injection. They are
 * NOT meant to run in production traffic paths — typical use:
 *
 *   const flaky = injectLatency(realCall, { mean: 200, jitter: 100 });
 *   await flaky(args);
 *
 * Every primitive accepts an `enabled` flag and an `rng` so tests can pin the
 * RNG and assert behaviour.
 */

export interface ChaosBaseOptions {
    /** When false the wrapper is a no-op pass-through. */
    enabled?: boolean;
    /** Custom RNG returning [0, 1). Defaults to `Math.random`. */
    rng?: () => number;
}

export interface InjectLatencyOptions extends ChaosBaseOptions {
    /** Mean delay in ms. */
    mean: number;
    /** Plus/minus this jitter, uniform. */
    jitter?: number;
}

/**
 * Wrap a function so each call sleeps for ~`mean ± jitter` ms before
 * forwarding. Sleep happens before the inner call.
 */
export function injectLatency<Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R> | R,
    opts: InjectLatencyOptions,
): (...args: Args) => Promise<R> {
    const enabled = opts.enabled ?? true;
    const rng = opts.rng ?? Math.random;
    const jitter = opts.jitter ?? 0;
    return async (...args: Args) => {
        if (enabled) {
            const offset = jitter === 0 ? 0 : (rng() * 2 - 1) * jitter;
            const delay = Math.max(0, opts.mean + offset);
            if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        }
        return fn(...args);
    };
}

export interface DropPercentageOptions extends ChaosBaseOptions {
    /** Drop probability in [0, 1]. */
    rate: number;
    /** Error to throw when dropping. */
    errorFactory?: () => Error;
}

/**
 * Wrap a function so a fraction of calls reject with a synthetic error.
 */
export function dropPercentage<Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R> | R,
    opts: DropPercentageOptions,
): (...args: Args) => Promise<R> {
    const enabled = opts.enabled ?? true;
    const rng = opts.rng ?? Math.random;
    const rate = Math.min(Math.max(opts.rate, 0), 1);
    const errorFactory = opts.errorFactory ?? (() => new Error('chaos: synthetic drop'));
    return async (...args: Args) => {
        if (enabled && rng() < rate) {
            throw errorFactory();
        }
        return fn(...args);
    };
}

export interface CorruptResponseOptions<R> extends ChaosBaseOptions {
    /** Probability of returning the corrupted value. */
    rate: number;
    /** Returns a corrupted variant of the original response. */
    corrupt: (original: R) => R;
}

/**
 * Wrap a function so a fraction of calls return a corrupted response. Useful
 * for verifying caller defensiveness against truncated / mutated payloads.
 */
export function corruptResponse<Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R> | R,
    opts: CorruptResponseOptions<R>,
): (...args: Args) => Promise<R> {
    const enabled = opts.enabled ?? true;
    const rng = opts.rng ?? Math.random;
    const rate = Math.min(Math.max(opts.rate, 0), 1);
    return async (...args: Args) => {
        const result = await fn(...args);
        if (enabled && rng() < rate) {
            return opts.corrupt(result);
        }
        return result;
    };
}
