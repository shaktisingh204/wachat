/**
 * SabSMS — AWS Pinpoint journey importer (V2.9, the "lifeboat").
 *
 * Pinpoint journeys EOL Oct 30 2026; this maps a Pinpoint journey
 * export (the `WriteJourneyRequest` / `GetJourney` JSON shape: an
 * `Activities` map + `StartActivity` pointer) onto a SabSMS journey
 * draft.
 *
 * Mapping:
 *   - SMS activities        → `send` steps. Bodies are not embedded in
 *                             Pinpoint journey exports (they live in
 *                             message templates), so each send step gets
 *                             a template DRAFT named "Imported — <name>";
 *                             when the export carries no inline body we
 *                             emit a placeholder body + warning.
 *   - Wait                  → `wait` steps (`WaitTime.WaitFor` ISO-8601
 *                             duration; `WaitUntil` absolute timestamps
 *                             are converted relative to import time with
 *                             a warning).
 *   - ConditionalSplit      → `branch` steps. Attribute-based segment
 *                             dimensions map onto vars conditions; event
 *                             / segment-id conditions can't be mapped
 *                             and are flagged.
 *   - EMAIL / PUSH / CUSTOM / ContactCenter / RandomSplit /
 *     MultiCondition / Holdout → `exit` placeholder + warning.
 *
 * Pure module (injectable clock) — `parsePinpointJourney` never touches
 * the DB; the drips server action persists templates + the journey.
 */

import {
  emptyJourneyStats,
  type JourneyStep,
  type SabsmsJourney,
} from '../journeys/types';

// ─── Result types ─────────────────────────────────────────────────────────

/** `send` steps reference templates-to-create as `ref:<index>`. */
export const TEMPLATE_REF_PREFIX = 'ref:';

export interface PinpointTemplateDraft {
  /** `ref:<index>` placeholder used in the mapped steps. */
  ref: string;
  name: string;
  body: string;
}

export type PinpointJourneyDraft = Omit<
  SabsmsJourney,
  '_id' | 'workspaceId' | 'createdAt' | 'updatedAt'
>;

export interface PinpointImportResult {
  journey: PinpointJourneyDraft;
  templates: PinpointTemplateDraft[];
  warnings: string[];
}

export interface PinpointParseOptions {
  now?: () => Date;
}

// ─── ISO-8601 duration ────────────────────────────────────────────────────

const ISO_DURATION_RE =
  /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i;

/** Parse a Pinpoint `WaitTime.WaitFor` duration ("PT24H", "P3D"…) → ms. */
export function parseIso8601DurationMs(input: string): number | null {
  const m = ISO_DURATION_RE.exec(input.trim());
  if (!m) return null;
  const [, w, d, h, min, s] = m;
  if (!w && !d && !h && !min && !s) return null;
  const ms =
    (Number(w ?? 0) * 7 * 24 * 3600 +
      Number(d ?? 0) * 24 * 3600 +
      Number(h ?? 0) * 3600 +
      Number(min ?? 0) * 60 +
      Number(s ?? 0)) *
    1000;
  return ms > 0 ? Math.round(ms) : null;
}

// ─── Pinpoint export shapes (the subset we read) ──────────────────────────

interface PinpointActivity {
  Description?: string;
  SMS?: {
    MessageConfig?: {
      MessageType?: string;
      SenderId?: string;
      OriginationNumber?: string;
      /** Not part of the official journey schema, but some exports /
       *  hand-merged dumps inline the template body here. */
      Body?: string;
    };
    NextActivity?: string;
    TemplateName?: string;
    TemplateVersion?: string;
  };
  EMAIL?: { NextActivity?: string; TemplateName?: string };
  PUSH?: { NextActivity?: string; TemplateName?: string };
  CUSTOM?: { NextActivity?: string };
  ContactCenter?: { NextActivity?: string };
  Wait?: {
    NextActivity?: string;
    WaitTime?: { WaitFor?: string; WaitUntil?: string };
  };
  ConditionalSplit?: {
    Condition?: {
      Conditions?: Array<{
        EventCondition?: unknown;
        SegmentCondition?: { SegmentId?: string };
        SegmentDimensions?: {
          Attributes?: Record<
            string,
            { AttributeType?: string; Values?: string[] }
          >;
        };
      }>;
      Operator?: string;
    };
    TrueActivity?: string;
    FalseActivity?: string;
    EvaluationWaitTime?: { WaitFor?: string; WaitUntil?: string };
  };
  MultiCondition?: { Branches?: unknown[]; DefaultActivity?: string };
  RandomSplit?: { Branches?: Array<{ NextActivity?: string }> };
  Holdout?: { NextActivity?: string; Percentage?: number };
}

interface PinpointJourneyExport {
  Name?: string;
  StartActivity?: string;
  Activities?: Record<string, PinpointActivity>;
}

// ─── Parser ───────────────────────────────────────────────────────────────

const EXIT_STEP_ID = '__exit';

function activityDisplayName(id: string, activity: PinpointActivity): string {
  return activity.Description?.trim() || activity.SMS?.TemplateName?.trim() || id;
}

/** BFS order from StartActivity so the linear step list reads top-down. */
function orderActivities(
  start: string | undefined,
  activities: Record<string, PinpointActivity>,
): { ordered: string[]; unreachable: string[] } {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const queue: string[] = start && activities[start] ? [start] : [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
    const a = activities[id];
    if (!a) continue;
    const nexts = [
      a.SMS?.NextActivity,
      a.EMAIL?.NextActivity,
      a.PUSH?.NextActivity,
      a.CUSTOM?.NextActivity,
      a.ContactCenter?.NextActivity,
      a.Wait?.NextActivity,
      a.ConditionalSplit?.TrueActivity,
      a.ConditionalSplit?.FalseActivity,
      a.Holdout?.NextActivity,
      a.MultiCondition?.DefaultActivity,
      ...(a.RandomSplit?.Branches?.map((b) => b.NextActivity) ?? []),
    ];
    for (const next of nexts) {
      if (next && activities[next] && !seen.has(next)) queue.push(next);
    }
  }

  const unreachable = Object.keys(activities).filter((id) => !seen.has(id));
  return { ordered, unreachable };
}

/**
 * Map one Pinpoint journey export onto a SabSMS journey draft +
 * template drafts + warnings. Throws only on structurally invalid input
 * (not JSON, no Activities) — every mappable-but-lossy construct
 * degrades to a placeholder + warning instead.
 */
export function parsePinpointJourney(
  input: unknown,
  opts: PinpointParseOptions = {},
): PinpointImportResult {
  const now = opts.now ?? (() => new Date());
  const warnings: string[] = [];
  const templates: PinpointTemplateDraft[] = [];

  let parsed: unknown = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error('Not valid JSON — paste the raw Pinpoint journey export.');
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected a Pinpoint journey export object.');
  }

  const journeyExport = parsed as PinpointJourneyExport;
  const activities = journeyExport.Activities;
  if (!activities || typeof activities !== 'object' || Object.keys(activities).length === 0) {
    throw new Error('Export has no Activities map — is this a Pinpoint journey export?');
  }

  const { ordered, unreachable } = orderActivities(journeyExport.StartActivity, activities);
  if (ordered.length === 0) {
    // No/invalid StartActivity — fall back to declaration order.
    warnings.push(
      'StartActivity missing or invalid — imported activities in declaration order.',
    );
    ordered.push(...Object.keys(activities));
  } else if (unreachable.length > 0) {
    warnings.push(
      `${unreachable.length} activit${unreachable.length === 1 ? 'y is' : 'ies are'} unreachable from StartActivity and were skipped: ${unreachable.join(', ')}.`,
    );
  }

  const steps: JourneyStep[] = [];
  let needsExitPlaceholder = false;

  for (const id of ordered) {
    const activity = activities[id];
    const name = activityDisplayName(id, activity);

    if (activity.SMS) {
      const inlineBody = activity.SMS.MessageConfig?.Body?.trim();
      const templateName = activity.SMS.TemplateName?.trim();
      let body = inlineBody ?? '';
      if (!body) {
        body = templateName
          ? `[Imported from Pinpoint template "${templateName}" — paste the template body here]`
          : '[Imported from Pinpoint — message body was not included in the export]';
        warnings.push(
          `SMS activity "${name}": the journey export does not embed the message body${templateName ? ` (Pinpoint template "${templateName}")` : ''} — a placeholder template draft was created; paste the real copy before activating.`,
        );
      }
      const ref = `${TEMPLATE_REF_PREFIX}${templates.length}`;
      templates.push({ ref, name: `Imported — ${name}`, body });
      steps.push({ id, kind: 'send', templateId: ref });
      continue;
    }

    if (activity.Wait) {
      const waitFor = activity.Wait.WaitTime?.WaitFor;
      const waitUntil = activity.Wait.WaitTime?.WaitUntil;
      let durationMs: number | null = null;
      if (waitFor) {
        durationMs = parseIso8601DurationMs(waitFor);
        if (durationMs === null) {
          warnings.push(
            `Wait activity "${name}": could not parse duration "${waitFor}" — defaulted to 1 day.`,
          );
        }
      } else if (waitUntil) {
        const until = Date.parse(waitUntil);
        if (Number.isFinite(until)) {
          durationMs = Math.max(until - now().getTime(), 60_000);
          warnings.push(
            `Wait activity "${name}": absolute WaitUntil "${waitUntil}" converted to a relative wait of ${Math.round(durationMs / 3_600_000)}h from import time — review before activating.`,
          );
        } else {
          warnings.push(
            `Wait activity "${name}": unparseable WaitUntil "${waitUntil}" — defaulted to 1 day.`,
          );
        }
      } else {
        warnings.push(`Wait activity "${name}": no WaitTime — defaulted to 1 day.`);
      }
      steps.push({ id, kind: 'wait', durationMs: durationMs ?? 24 * 3600 * 1000 });
      continue;
    }

    if (activity.ConditionalSplit) {
      const split = activity.ConditionalSplit;
      const conditions = split.Condition?.Conditions ?? [];
      const first = conditions[0];
      const attributes = first?.SegmentDimensions?.Attributes;
      const attrEntry = attributes ? Object.entries(attributes)[0] : undefined;

      let condition: { field: string; op: 'eq'; value: string };
      if (attrEntry && (attrEntry[1].Values?.length ?? 0) > 0) {
        condition = { field: attrEntry[0], op: 'eq', value: String(attrEntry[1].Values![0]) };
        if (attrEntry[1].AttributeType && attrEntry[1].AttributeType !== 'INCLUSIVE') {
          warnings.push(
            `ConditionalSplit "${name}": attribute type "${attrEntry[1].AttributeType}" approximated as equals — review the branch condition.`,
          );
        }
      } else {
        condition = { field: '__pinpoint_unmapped', op: 'eq', value: 'true' };
        const why = first?.EventCondition
          ? 'event conditions'
          : first?.SegmentCondition
            ? 'segment-membership conditions'
            : 'this condition shape';
        warnings.push(
          `ConditionalSplit "${name}": SabSMS branches evaluate run vars — ${why} could not be mapped; the branch was imported with a placeholder condition (always false). Edit it before activating.`,
        );
      }
      if (conditions.length > 1) {
        warnings.push(
          `ConditionalSplit "${name}": only the first of ${conditions.length} conditions was mapped (operator ${split.Condition?.Operator ?? 'ALL'}).`,
        );
      }

      const trueTarget =
        split.TrueActivity && activities[split.TrueActivity] ? split.TrueActivity : EXIT_STEP_ID;
      const falseTarget =
        split.FalseActivity && activities[split.FalseActivity] ? split.FalseActivity : EXIT_STEP_ID;
      if (trueTarget === EXIT_STEP_ID || falseTarget === EXIT_STEP_ID) {
        needsExitPlaceholder = true;
      }
      steps.push({
        id,
        kind: 'branch',
        condition,
        trueStepId: trueTarget,
        falseStepId: falseTarget,
      });
      continue;
    }

    // Unsupported activity types → exit placeholder + warning.
    const unsupported = activity.EMAIL
      ? 'EMAIL'
      : activity.PUSH
        ? 'PUSH'
        : activity.CUSTOM
          ? 'CUSTOM'
          : activity.ContactCenter
            ? 'ContactCenter'
            : activity.RandomSplit
              ? 'RandomSplit'
              : activity.MultiCondition
                ? 'MultiCondition'
                : activity.Holdout
                  ? 'Holdout'
                  : 'unknown';
    warnings.push(
      `Activity "${name}" (${unsupported}) is not supported by SabSMS journeys — replaced with an exit step.`,
    );
    steps.push({ id, kind: 'exit' });
  }

  if (needsExitPlaceholder) {
    steps.push({ id: EXIT_STEP_ID, kind: 'exit' });
  }

  const journey: PinpointJourneyDraft = {
    name: journeyExport.Name?.trim() || 'Imported Pinpoint journey',
    status: 'draft',
    trigger: { kind: 'manual' },
    steps,
    exitRules: { onUnsubscribe: true },
    stats: emptyJourneyStats(),
  };

  return { journey, templates, warnings };
}
