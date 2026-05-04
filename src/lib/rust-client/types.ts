/**
 * Manually-maintained mirror of the Rust DTO types.
 *
 * NOTE: this file is a temporary hand-port of `rust/crates/users/src/dto.rs`
 * and similar modules. Once `scripts/gen-rust-client.ts` is wired into CI it
 * will overwrite `src/lib/rust-client/generated.ts` with the real types
 * derived from the OpenAPI spec, and consumers should switch to importing
 * from there. Until then, keep these in sync by hand.
 *
 * Source of truth:
 * - {@link file://./../../../rust/crates/users/src/dto.rs}
 */
export interface MeResponse {
    /** Mongo `_id` of the authenticated user, as a hex string. */
    id: string;
    /** Primary email address. */
    email: string;
    /** Optional display name. */
    name?: string | null;
    /** ISO-8601 UTC timestamp of when the user record was created. */
    created_at: string;
}

/**
 * Stable error envelope returned by every Rust handler on a non-2xx response.
 * Matches `ErrorEnvelope` in `rust/crates/common/src/error.rs`.
 */
export interface RustErrorEnvelope {
    ok: false;
    error: {
        /** UPPER_SNAKE_CASE machine-readable code (e.g. `"NOT_FOUND"`). */
        code: string;
        /** Human-readable message. May be redacted for 5xx errors. */
        message: string;
    };
}
