/**
 * Ad-manager — last surviving piece of this module is the
 * `ActionResult` envelope type used by the Server Actions.
 *
 * The original zod schemas + `validate()` helper were removed when
 * the migration to the Rust BFF (`rust/crates/ad-manager`) became
 * complete. Rust + Graph now own all input validation; surfacing
 * messages happens through the `error` field of this envelope.
 *
 * Kept here (rather than inlined in the action file) because
 * `'use server'` modules cannot export non-async values, and the UI
 * imports this type from a few places.
 */

export type ActionResult<T = unknown> = { data?: T; error?: string };
