import 'server-only';

/**
 * SabCRM — read-path access-enforcement ORCHESTRATOR (server-only).
 *
 * Threads the three independently-flag-gated SabCRM enforcement engines into the
 * NATIVE-TS `sabcrm_records` read path (`./records.server.ts`), STRICTLY behind
 * the existing DEFAULT-OFF per-project flags. It is the single seam the read
 * path calls; the pure composition + the security-critical passthrough invariant
 * live in `./access-readpath.ts`.
 *
 * ## SECURITY CONTRACT — DEFAULT-OFF, byte-for-byte passthrough
 *
 * Three SEPARATE flags, each default-OFF, are read independently:
 *   - access enforcement → `accessibleFilterFor` (`sabcrm_access_flags`)
 *   - sharing rules      → `buildSharingClause`   (`sabcrm_access_enforcement`)
 *   - territory roll-up  → `isTerritoryEnforcementEnabled` + `territoryAccessUserIds`
 *                                                  (`sabcrm_territory_settings`)
 *   - field-level security (read redaction) → `redactForViewer` (`sabcrm_fls_settings`)
 *
 * When EVERY relevant flag is off (the default for all projects today),
 * {@link applyReadEnforcement} returns the SAME `baseFilter` reference and
 * {@link redactReadResults} returns the SAME records array — so the read is
 * byte-for-byte identical to today. Nothing here is enabled by shipping it.
 *
 * ## Fail direction
 *
 *  - Flags OFF / unreadable  → fail-OPEN: return the base filter / records
 *    unchanged (= today). A downed config store NEVER breaks a read.
 *  - Flags ON                → narrowing-only, deny-by-default; an error while
 *    enforcing fails CLOSED (deny sentinel for the filter; FLS keeps the
 *    documented read fail-open for redaction so a config error can't blank a
 *    list — see `fls.server.ts`).
 *
 * ## Two-store gotcha (IMPORTANT — reviewer checklist in the action header)
 *
 * This wires enforcement onto the NATIVE-TS read path ONLY. The RUST read path
 * does NOT consult any of these engines; records served straight from the Rust
 * crate are NEITHER filtered NOR redacted by this module. The flag cannot be
 * trusted as a hard boundary until a parallel change lands crate-side. All four
 * underlying engines document this same gap.
 */

import {
  accessibleFilterFor,
  getEnforcementFlag,
  enforcementMode,
} from './access-enforcement.server';
import {
  buildSharingClause,
  isSharingEnforcementEnabled,
} from './sharing-rules.server';
import {
  isTerritoryEnforcementEnabled,
  territoryAccessUserIds,
} from './territory.server';
import {
  isFlsEnforced,
  redactForViewer,
  resolveViewerFlsRole,
} from './fls.server';
import {
  composeReadFilter,
  DENY_SENTINEL,
  type MongoClause,
  type ReadEnforcementInputs,
} from './access-readpath';

export {
  composeReadFilter,
  DENY_SENTINEL,
  type MongoClause,
  type ReadEnforcementInputs,
} from './access-readpath';

/**
 * Apply read-path access enforcement to one object's base read filter.
 *
 * DEFAULT-OFF: when NONE of the access / sharing / territory flags are on for
 * this project, returns `baseFilter` UNCHANGED (the same reference) — the read
 * is byte-for-byte today's read. Resolving the flags is best-effort: a flag-read
 * error degrades that source to OFF (fail-open) so the surface keeps working.
 *
 * When at least one flag is on, narrows `baseFilter` by AND-ing the compiled
 * accessible clause, additively OR-ing the sharing clause and the territory
 * owner-id union into the accessible owner scope, deny-by-default. An error
 * WHILE ENFORCING fails CLOSED (deny sentinel).
 *
 * NATIVE-TS read path only — the Rust path is NOT covered (two-store gotcha).
 *
 * @param object    object slug being read
 * @param baseFilter the filter `records.server` already built (tenant + owner +
 *                   conditions). Returned unchanged when all flags are off.
 */
export async function applyReadEnforcement(
  projectId: string,
  viewerUserId: string,
  object: string,
  baseFilter: MongoClause,
): Promise<MongoClause> {
  // Resolve every flag INDEPENDENTLY and best-effort. A flag-read error → that
  // source is treated as OFF (fail toward today's behaviour). We deliberately
  // gate on the flags FIRST so that, in the all-off common case, we never touch
  // the heavier clause-resolution paths.
  let accessOn = false;
  let sharingOn = false;
  let territoryOn = false;
  try {
    accessOn = enforcementMode(await getEnforcementFlag(projectId)) === 'enforce';
  } catch {
    accessOn = false;
  }
  try {
    sharingOn = await isSharingEnforcementEnabled(projectId);
  } catch {
    sharingOn = false;
  }
  try {
    territoryOn = await isTerritoryEnforcementEnabled(projectId);
  } catch {
    territoryOn = false;
  }

  const anyFlagOn = accessOn || sharingOn || territoryOn;

  // SECURITY-CRITICAL: all flags off → identical passthrough, no clause work.
  if (!anyFlagOn) return baseFilter;

  // At least one flag is on. From here a failure fails CLOSED (deny) rather than
  // silently returning the unenforced base.
  try {
    // Elevation (owner/admin) bypasses record-level narrowing — resolved via the
    // FLS engine's self-contained role resolver so it works for ANY viewer id
    // (not just the live session user). owner/admin → elevated.
    const role = await resolveViewerFlsRole(projectId, viewerUserId);
    const elevated = role === 'owner' || role === 'admin';

    // Resolve each enforcement source ONLY when its flag is on. Each underlying
    // helper is itself flag-gated and fail-safe, but gating here keeps the
    // all-but-one-off cases cheap and the inputs unambiguous for the pure core.
    const accessible: MongoClause | null = accessOn
      ? await accessibleFilterFor({ projectId, viewerUserId, object, elevated })
      : null;

    // Sharing only WIDENS, and only matters when access enforcement is also
    // narrowing (there is nothing to widen otherwise). buildSharingClause is
    // itself flag-gated (returns null when its own flag is off).
    const sharing: MongoClause | null =
      sharingOn && !elevated ? await buildSharingClause(projectId, object, viewerUserId) : null;

    // Territory owner-id union — only when its flag is on and the viewer is not
    // elevated (elevated already sees the whole tenant).
    const territoryOwnerIds: string[] | null =
      territoryOn && !elevated
        ? await territoryAccessUserIds(projectId, viewerUserId)
        : null;

    const inputs: ReadEnforcementInputs = {
      accessible,
      sharing,
      territoryOwnerIds,
      anyFlagOn: true,
    };
    return composeReadFilter(baseFilter, inputs);
  } catch {
    // Enforcing but something failed — fail CLOSED so we never leak rows the
    // enforcement was meant to hide.
    return { ...baseFilter, ...DENY_SENTINEL };
  }
}

/**
 * Apply field-level-security redaction to a batch of read results.
 *
 * DEFAULT-OFF: when the per-project FLS flag is off (the default), returns the
 * input `records` array UNCHANGED. When on, strips FLS-hidden field data for the
 * viewer's role via the FLS engine. Best-effort and read-fail-OPEN by the FLS
 * engine's own contract (a config error never blanks a list).
 *
 * Generic over the record shape; only `data` is touched. NATIVE-TS read path
 * only — the Rust path is NOT redacted (two-store gotcha).
 */
export async function redactReadResults<
  T extends { data?: Record<string, unknown> | null | undefined },
>(
  projectId: string,
  viewerUserId: string,
  object: string,
  records: T[],
): Promise<T[]> {
  try {
    if (!Array.isArray(records) || records.length === 0) return records;
    // Gate cheaply first so the all-off path never resolves roles/policies.
    if (!(await isFlsEnforced(projectId))) return records;
    return await redactForViewer(projectId, object, viewerUserId, records);
  } catch {
    // FLS read redaction is documented fail-OPEN: never blank a list on error.
    return records;
  }
}
