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
 * ## Two-store gotcha — now closed for the record read path
 *
 * Historically this wired enforcement onto the NATIVE-TS read path ONLY. The
 * RUST read path is now covered too: {@link resolveAccessFilterParam} serializes
 * the SAME composed enforcement clause and the Rust `sabcrm-records` crate
 * `$and`-merges it server-side (`apply_access_filter`), while
 * {@link redactReadResults} applies FLS to the returned rows. Both are threaded
 * through the central Tw read seams in `src/app/actions/sabcrm-twenty.actions.ts`
 * (`listSabcrmRecordsTw`, `countSabcrmRecordsTw`, `groupSabcrmRecordsTw`,
 * `aggregateSabcrmRecordsTw`, `getSabcrmRecordTw`, `listRelatedSabcrmRecordsTw`,
 * `searchSabcrmRecordOptionsTw`) — so a record the viewer may not see is
 * filtered regardless of which store served it. The access POLICY still lives in
 * exactly one place (this module); Rust only applies the resolved clause.
 *
 * Still DEFAULT-OFF: with every flag off, `resolveAccessFilterParam` returns
 * `undefined`, the Rust `accessFilter` param is omitted, and the query is
 * byte-for-byte today's query. Remaining uncovered readers (wire the same way
 * before relying on the flag as a hard boundary): the cross-object global
 * `search` endpoint and any bespoke call site that hits `sabcrmRecordsApi`
 * directly instead of these seams.
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
 * Resolve the read-path enforcement clause as a serialized param for the **Rust**
 * record read path (`sabcrmRecordsApi.list/count/group/get`), closing the
 * two-store gotcha: the Rust crate now `$and`-merges this exact clause (see
 * `apply_access_filter` in `rust/crates/sabcrm-records`), so a record the viewer
 * may not see is filtered server-side regardless of which store served it.
 *
 * DEFAULT-OFF: reuses {@link applyReadEnforcement} with an EMPTY base filter, so
 * the result is the pure enforcement clause — or `undefined` when every flag is
 * off (the common case), in which case callers omit the param entirely and the
 * Rust query is byte-for-byte today's query. There is NO second copy of the
 * access policy here: the whole resolution (OWD, role hierarchy, sharing,
 * territory) stays in {@link applyReadEnforcement}; this only serializes it.
 *
 * Note: field-level-security REDACTION is applied separately on the returned
 * records via {@link redactReadResults} (it strips field data, not whole rows).
 *
 * @returns a JSON string to pass as the Rust `accessFilter` param, or
 *          `undefined` when nothing is enforced (omit the param).
 */
export async function resolveAccessFilterParam(
  projectId: string,
  viewerUserId: string,
  object: string,
): Promise<string | undefined> {
  try {
    // Empty base → composeReadFilter returns the pure enforcement clause (or the
    // deny sentinel `{_id:null}`), or the SAME empty object on full passthrough.
    const clause = await applyReadEnforcement(projectId, viewerUserId, object, {});
    if (!clause || Object.keys(clause).length === 0) return undefined;
    return JSON.stringify(clause);
  } catch {
    // applyReadEnforcement is itself fail-closed when enforcing and fail-open
    // when off; a throw here is unexpected, so omit the param (the Rust path is
    // then unenforced — identical to today, never MORE permissive than intended
    // because enforcement is opt-in per project).
    return undefined;
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
