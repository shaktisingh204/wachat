import 'server-only';

import { RustApiError } from '@/lib/rust-client/fetcher';

/**
 * Shared "is the Rust BFF unreachable?" predicate.
 *
 * The Telegram action layer was migrated to call the Rust BFF, but in
 * environments where that binary is missing or stale every call returns
 * 404 (or 5xx). When the answer is "Rust isn't there", action wrappers
 * should fall back to direct Mongo reads instead of bubbling
 * `"Rust API 404 Not Found"` up to the UI as a red error banner.
 *
 *   - 404: the route isn't deployed in the current binary.
 *   - 5xx: the binary is up but the handler is failing.
 *   - 0:   network error (DNS, TLS, refused connection).
 *
 * Auth/4xx (other than 404) should still surface — those are real
 * issues the user can act on.
 */
export function isRustUnavailable(err: unknown): err is RustApiError {
    if (!(err instanceof RustApiError)) return false;
    return err.status === 404 || err.status >= 500 || err.status === 0;
}

/**
 * Convenience wrapper. Tries the Rust call; if it throws and the error
 * is "Rust unavailable", runs the fallback. Anything else re-throws.
 */
export async function withRustFallback<T>(
    rust: () => Promise<T>,
    fallback: () => Promise<T>,
): Promise<T> {
    try {
        return await rust();
    } catch (err) {
        if (isRustUnavailable(err)) {
            return await fallback();
        }
        throw err;
    }
}
