/**
 * SabCRM Settings — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the settings actions surface to their (client) callers lives
 * in this plain sibling module. Importing it has no runtime cost.
 *
 * These wrap the Rust settings client wire shape
 * (`@/lib/rust-client/sabcrm-settings`) into the small, serialisable payloads
 * the SabCRM settings UI consumes.
 */

export type { SabcrmRustSettings } from '@/lib/rust-client/sabcrm-settings';

/** Free-form settings map read/returned by the settings actions. */
export type CrmSettings = Record<string, unknown>;

/** Partial patch accepted by `updateCrmSettingsTw` — merged key by key. */
export type CrmSettingsPatch = Record<string, unknown>;
