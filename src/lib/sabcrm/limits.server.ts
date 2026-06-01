import "server-only";

/**
 * SabCRM — per-plan quantitative limit enforcement.
 *
 * SabCRM is gated for *access* by RBAC capability keys + the `sabcrmPlanFeature`
 * on/off flag (see `gate()` in `src/app/actions/sabcrm.actions.ts`). What that
 * pipeline does NOT do is cap *how much* a tenant can create — the number of
 * CRM records or user-defined custom objects.
 *
 * This module supplies that missing layer. It is count-based rather than
 * usage-event-based on purpose: CRM records and custom objects are stateful
 * entities (they get deleted, which frees quota), so the live `countDocuments`
 * against the tenant-scoped collections is the source of truth — unlike the
 * append-only `usage_events` ledger in `@/lib/billing` which models monotonic
 * monthly consumption (messages sent, AI tokens, etc.).
 *
 * The plan tier is resolved from the project's `planId -> plans` document and
 * normalised onto the same `free | starter | pro | business | enterprise`
 * ladder used by the billing entitlements table, so caps stay consistent with
 * the rest of the SaaS plan ladder.
 *
 * Two call styles are provided:
 *   - `assertWithin*` — throws {@link SabcrmLimitError} when at/over cap, so
 *     gated server actions can fail closed with a clear, user-facing message.
 *   - `check*` / `getSabcrmLimitUsage` — non-throwing, returns the usage/cap
 *     snapshot for rendering meters and disabling "New" buttons in the UI.
 *
 * All reads are tenant-scoped by `projectId`.
 */

import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";
import { sabcrmObjects, sabcrmRecords } from "./db";

/* ------------------------------------------------------------------ *
 * Plan tiers + cap table
 * ------------------------------------------------------------------ */

/**
 * Normalised SabCRM plan tier. Mirrors the billing entitlement ladder
 * (`src/lib/billing/entitlements.ts`) so caps read consistently across the
 * product even though SabCRM's caps live here rather than in `MeteredFeature`.
 */
export type SabcrmTier =
  | "free"
  | "starter"
  | "pro"
  | "business"
  | "enterprise";

/** A quantitative limit. `UNLIMITED` (-1) means no cap; `0` disables creation. */
export const UNLIMITED = -1 as const;

/** Per-tier SabCRM quantitative caps. `-1` = unlimited, `0` = disabled. */
export interface SabcrmLimitCaps {
  /** Maximum total CRM records (across every object) per project. */
  maxRecords: number;
  /** Maximum user-defined custom objects per project (standard objects free). */
  maxCustomObjects: number;
  /** Maximum custom fields appended to any single object. */
  maxCustomFieldsPerObject: number;
}

/**
 * Sane default caps per tier. SabCRM is access-gated off on `free` (the billing
 * table sets `features.crm = false` for free), so the free row exists only as a
 * safe fallback for misconfigured / unresolved plans and keeps creation tightly
 * bounded.
 */
export const SABCRM_LIMIT_TABLE: Record<SabcrmTier, SabcrmLimitCaps> = {
  free: {
    maxRecords: 100,
    maxCustomObjects: 0,
    maxCustomFieldsPerObject: 5,
  },
  starter: {
    maxRecords: 5_000,
    maxCustomObjects: 3,
    maxCustomFieldsPerObject: 20,
  },
  pro: {
    maxRecords: 50_000,
    maxCustomObjects: 25,
    maxCustomFieldsPerObject: 60,
  },
  business: {
    maxRecords: 500_000,
    maxCustomObjects: 100,
    maxCustomFieldsPerObject: 150,
  },
  enterprise: {
    maxRecords: UNLIMITED,
    maxCustomObjects: UNLIMITED,
    maxCustomFieldsPerObject: UNLIMITED,
  },
};

/** The metered SabCRM quantity a limit check refers to. */
export type SabcrmLimitFeature =
  | "records"
  | "custom_objects"
  | "custom_fields_per_object";

/** Human-readable noun for each feature, used in error/UX copy. */
const FEATURE_LABEL: Record<SabcrmLimitFeature, string> = {
  records: "records",
  custom_objects: "custom objects",
  custom_fields_per_object: "custom fields on this object",
};

/** Resolve a feature's cap from a tier's cap row. */
function capFor(caps: SabcrmLimitCaps, feature: SabcrmLimitFeature): number {
  switch (feature) {
    case "records":
      return caps.maxRecords;
    case "custom_objects":
      return caps.maxCustomObjects;
    case "custom_fields_per_object":
      return caps.maxCustomFieldsPerObject;
  }
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

/**
 * Thrown when a SabCRM quantitative limit would be exceeded. The action layer
 * normalises thrown errors into `{ ok: false, error: e.message }`, so the
 * `.message` here is the copy a user sees. `feature`/`tier`/`cap`/`used` are
 * attached for callers that want to render a richer upsell prompt.
 */
export class SabcrmLimitError extends Error {
  readonly feature: SabcrmLimitFeature;
  readonly tier: SabcrmTier;
  readonly cap: number;
  readonly used: number;

  constructor(args: {
    feature: SabcrmLimitFeature;
    tier: SabcrmTier;
    cap: number;
    used: number;
  }) {
    const noun = FEATURE_LABEL[args.feature];
    const message =
      args.cap === 0
        ? `Your plan does not allow creating ${noun}. Upgrade to add ${noun}.`
        : `You've reached your plan limit of ${args.cap.toLocaleString()} ${noun}. Upgrade your plan to add more.`;
    super(message);
    this.name = "SabcrmLimitError";
    this.feature = args.feature;
    this.tier = args.tier;
    this.cap = args.cap;
    this.used = args.used;
  }
}

/* ------------------------------------------------------------------ *
 * Plan-tier resolution
 * ------------------------------------------------------------------ */

/**
 * Match the keywords a plan `name` may contain onto a normalised tier. The
 * `plans` collection stores human labels ("Pro", "Business Plus", "Free Tier"),
 * not the canonical ladder keys, so we infer the tier from the label. Order
 * matters: more specific / higher tiers are checked first.
 */
const TIER_KEYWORDS: ReadonlyArray<readonly [SabcrmTier, RegExp]> = [
  ["enterprise", /enterprise|unlimited|ultimate|custom/i],
  ["business", /business|team|growth|scale|agency/i],
  ["pro", /\bpro\b|professional|premium|advanced/i],
  ["starter", /starter|basic|standard|lite|essential/i],
  ["free", /free|trial/i],
];

function tierFromPlanName(name: string | undefined | null): SabcrmTier | null {
  if (!name) return null;
  for (const [tier, re] of TIER_KEYWORDS) {
    if (re.test(name)) return tier;
  }
  return null;
}

/** Minimal projection of the `plans` document needed to derive a tier. */
interface PlanTierDoc {
  name?: string;
  price?: number;
  isDefault?: boolean;
}

/** Minimal projection of a `projects` document needed to resolve its plan. */
interface ProjectPlanDoc {
  planId?: ObjectId | string;
}

/**
 * Resolve the normalised SabCRM tier for a project.
 *
 * Strategy:
 *   1. Read the project's `planId` and load the referenced `plans` document.
 *   2. Fall back to the `isDefault` plan when the project has no plan.
 *   3. Infer the tier from the plan name; if the name is unrecognised, infer
 *      from price (a paid plan is at least `starter`).
 *   4. Fail safe to `free` when nothing resolves — `free` is the most
 *      restrictive row, so an unresolved plan never grants extra quota.
 */
export async function resolveProjectTier(projectId: string): Promise<SabcrmTier> {
  if (!projectId) return "free";

  try {
    const { db } = await connectToDatabase();

    let planDoc: PlanTierDoc | null = null;

    if (ObjectId.isValid(projectId)) {
      const project = await db
        .collection<ProjectPlanDoc>("projects")
        .findOne(
          { _id: new ObjectId(projectId) },
          { projection: { planId: 1 } },
        );

      const rawPlanId = project?.planId;
      if (rawPlanId && ObjectId.isValid(rawPlanId)) {
        planDoc = await db
          .collection<PlanTierDoc>("plans")
          .findOne(
            { _id: new ObjectId(rawPlanId) },
            { projection: { name: 1, price: 1, isDefault: 1 } },
          );
      }
    }

    // No plan on the project — use the default plan as the baseline.
    if (!planDoc) {
      planDoc = await db
        .collection<PlanTierDoc>("plans")
        .findOne(
          { isDefault: true },
          { projection: { name: 1, price: 1, isDefault: 1 } },
        );
    }

    if (!planDoc) return "free";

    const byName = tierFromPlanName(planDoc.name);
    if (byName) return byName;

    // Unrecognised name: a priced plan is at minimum "starter".
    if (typeof planDoc.price === "number" && planDoc.price > 0) {
      return "starter";
    }

    return "free";
  } catch {
    // Never let a billing lookup failure block a CRM write decision; fail safe
    // to the most restrictive tier so we still enforce *some* bound.
    return "free";
  }
}

/** Resolve the active cap row for a project. */
export async function resolveProjectLimits(
  projectId: string,
): Promise<{ tier: SabcrmTier; caps: SabcrmLimitCaps }> {
  const tier = await resolveProjectTier(projectId);
  return { tier, caps: SABCRM_LIMIT_TABLE[tier] };
}

/* ------------------------------------------------------------------ *
 * Live counts (tenant-scoped)
 * ------------------------------------------------------------------ */

/** Count all CRM records in a project (across every object). */
export async function countAllRecords(projectId: string): Promise<number> {
  const col = await sabcrmRecords();
  return col.countDocuments({ projectId });
}

/**
 * Count user-defined custom objects in a project.
 *
 * The `sabcrm_objects` collection holds two kinds of doc: standard-object
 * overlays (`extendsStandard: true`) and fully-custom objects
 * (`extendsStandard: false`). Only the latter count against the cap — standard
 * objects ship with the product and are free.
 */
export async function countCustomObjects(projectId: string): Promise<number> {
  const col = await sabcrmObjects();
  return col.countDocuments({ projectId, extendsStandard: { $ne: true } });
}

/**
 * Count the custom (non-system, non-standard) fields persisted on one object.
 *
 * Standard fields always come from code and are re-based at read time, so the
 * persisted `fields` array on a doc already represents the custom additions for
 * a fully-custom object, plus the standard set for an overlay. We count only
 * fields that are not flagged `system` to approximate the user-defined surface.
 */
export async function countCustomFields(
  projectId: string,
  slug: string,
): Promise<number> {
  const col = await sabcrmObjects();
  const doc = await col.findOne(
    { projectId, slug },
    { projection: { fields: 1, extendsStandard: 1 } },
  );
  if (!doc?.fields) return 0;
  return doc.fields.filter((f) => f.system !== true).length;
}

/* ------------------------------------------------------------------ *
 * Non-throwing checks (for UI / pre-flight)
 * ------------------------------------------------------------------ */

/** Result of a non-throwing limit check. */
export interface SabcrmLimitCheck {
  feature: SabcrmLimitFeature;
  tier: SabcrmTier;
  /** Configured cap. `-1` = unlimited, `0` = disabled. */
  cap: number;
  /** Live usage at the time of the check. */
  used: number;
  /** Remaining headroom; `Infinity` when unlimited. */
  remaining: number;
  /** Whether creating one more is currently allowed. */
  ok: boolean;
}

function evaluate(
  feature: SabcrmLimitFeature,
  tier: SabcrmTier,
  cap: number,
  used: number,
): SabcrmLimitCheck {
  if (cap === UNLIMITED) {
    return { feature, tier, cap, used, remaining: Infinity, ok: true };
  }
  const remaining = Math.max(0, cap - used);
  return { feature, tier, cap, used, remaining, ok: used < cap };
}

/** Non-throwing check: can the project create one more record? */
export async function checkRecordLimit(
  projectId: string,
): Promise<SabcrmLimitCheck> {
  const [{ tier, caps }, used] = await Promise.all([
    resolveProjectLimits(projectId),
    countAllRecords(projectId),
  ]);
  return evaluate("records", tier, capFor(caps, "records"), used);
}

/** Non-throwing check: can the project create one more custom object? */
export async function checkCustomObjectLimit(
  projectId: string,
): Promise<SabcrmLimitCheck> {
  const [{ tier, caps }, used] = await Promise.all([
    resolveProjectLimits(projectId),
    countCustomObjects(projectId),
  ]);
  return evaluate(
    "custom_objects",
    tier,
    capFor(caps, "custom_objects"),
    used,
  );
}

/** Non-throwing check: can one more custom field be added to `slug`? */
export async function checkCustomFieldLimit(
  projectId: string,
  slug: string,
): Promise<SabcrmLimitCheck> {
  const [{ tier, caps }, used] = await Promise.all([
    resolveProjectLimits(projectId),
    countCustomFields(projectId, slug),
  ]);
  return evaluate(
    "custom_fields_per_object",
    tier,
    capFor(caps, "custom_fields_per_object"),
    used,
  );
}

/** A full usage snapshot for a project, for rendering plan-limit meters. */
export interface SabcrmLimitUsage {
  tier: SabcrmTier;
  caps: SabcrmLimitCaps;
  records: SabcrmLimitCheck;
  customObjects: SabcrmLimitCheck;
}

/**
 * Aggregate usage snapshot (records + custom objects). Per-object field usage
 * is object-scoped, so it is fetched separately via {@link checkCustomFieldLimit}.
 */
export async function getSabcrmLimitUsage(
  projectId: string,
): Promise<SabcrmLimitUsage> {
  const [{ tier, caps }, recordCount, objectCount] = await Promise.all([
    resolveProjectLimits(projectId),
    countAllRecords(projectId),
    countCustomObjects(projectId),
  ]);

  return {
    tier,
    caps,
    records: evaluate("records", tier, capFor(caps, "records"), recordCount),
    customObjects: evaluate(
      "custom_objects",
      tier,
      capFor(caps, "custom_objects"),
      objectCount,
    ),
  };
}

/* ------------------------------------------------------------------ *
 * Throwing assertions (for gated server actions — fail closed)
 * ------------------------------------------------------------------ */

function assertCheck(check: SabcrmLimitCheck): void {
  if (!check.ok) {
    throw new SabcrmLimitError({
      feature: check.feature,
      tier: check.tier,
      cap: check.cap,
      used: check.used,
    });
  }
}

/**
 * Throw {@link SabcrmLimitError} if the project is at/over its record cap.
 * Call before `createRecord` (and before a bulk import — pass the batch size).
 *
 * @param incoming number of records about to be created (default 1). A bulk
 *                 import that would push the tenant over the cap is rejected as
 *                 a whole so we never half-import.
 */
export async function assertWithinRecordLimit(
  projectId: string,
  incoming = 1,
): Promise<void> {
  const { tier, caps } = await resolveProjectLimits(projectId);
  const cap = capFor(caps, "records");
  if (cap === UNLIMITED) return;

  const used = await countAllRecords(projectId);
  if (used + Math.max(0, incoming) > cap) {
    throw new SabcrmLimitError({ feature: "records", tier, cap, used });
  }
}

/**
 * Throw {@link SabcrmLimitError} if the project is at/over its custom-object
 * cap. Call before `createCustomObject`.
 */
export async function assertWithinCustomObjectLimit(
  projectId: string,
): Promise<void> {
  assertCheck(await checkCustomObjectLimit(projectId));
}

/**
 * Throw {@link SabcrmLimitError} if object `slug` is at/over its custom-field
 * cap. Call before `addCustomField` / `addField`.
 */
export async function assertWithinCustomFieldLimit(
  projectId: string,
  slug: string,
): Promise<void> {
  assertCheck(await checkCustomFieldLimit(projectId, slug));
}
