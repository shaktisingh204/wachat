'use server';

/**
 * SabBigin automations — tenant-scoped CRUD over the `crm_automations`
 * collection, written in the §6.7 document shape the runtime engine reads
 * (`src/lib/automations/dispatch.ts` → `normaliseAutomation`).
 *
 * Stored shape per rule:
 *   {
 *     name, description?, isEnabled, status,
 *     trigger: { type, config: { entityKind, fieldName?, fromValue?, toValue?, elapsedMinutes? } },
 *     conditions: [{ kind, field?, value }],
 *     actions:    [{ kind, config }],
 *     userId, createdAt, updatedAt, lastRunAt?
 *   }
 *
 * The builder may configure action kinds the engine does not execute yet
 * (e.g. `send_whatsapp_template`); those are persisted verbatim so the rule
 * round-trips for editing. The engine's `normaliseActions` trusts the stored
 * shape and the action handlers validate at run time, so unknown kinds are
 * simply skipped at dispatch instead of crashing.
 *
 * SabBigin differentiator: there is NO execution cap here — workflows are
 * unlimited. Do not add one.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

const COLL = 'crm_automations';

/* --------------------------------------------------------------------
 * Serialisable input / output shapes
 * ------------------------------------------------------------------ */

export interface SabbiginTriggerInput {
  /** Engine trigger types + UI-only convenience kinds we map onto them. */
  type:
    | 'entity_created'
    | 'entity_updated'
    | 'status_changed'
    | 'stage_changed'
    | 'time_elapsed';
  config: {
    entityKind:
      | 'lead'
      | 'deal'
      | 'task'
      | 'contact'
      | 'account'
      | 'form_submission';
    fieldName?: string;
    fromValue?: string;
    toValue?: string;
    elapsedMinutes?: number;
  };
}

export interface SabbiginConditionInput {
  kind: 'field_equals' | 'field_in' | 'has_tag' | 'in_stage';
  field?: string;
  value: unknown;
}

export interface SabbiginActionInput {
  /** Engine-supported kinds + builder-only kinds persisted for round-trip. */
  kind:
    | 'update_field'
    | 'create_task'
    | 'send_email'
    | 'send_whatsapp_template'
    | 'webhook';
  config: Record<string, unknown>;
}

export interface SabbiginAutomationInput {
  id?: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: SabbiginTriggerInput;
  conditions: SabbiginConditionInput[];
  actions: SabbiginActionInput[];
}

/** Lightweight row for the rules-list table. */
export interface SabbiginAutomationRow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  status: string;
  triggerType: SabbiginTriggerInput['type'];
  entityKind: SabbiginTriggerInput['config']['entityKind'] | null;
  triggerSummary: string;
  conditionCount: number;
  actionCount: number;
  lastRunAt: string | null;
  updatedAt: string | null;
}

/** Full rule for the builder to reload + edit. */
export interface SabbiginAutomationDetail {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: string;
  trigger: SabbiginTriggerInput;
  conditions: SabbiginConditionInput[];
  actions: SabbiginActionInput[];
}

/* --------------------------------------------------------------------
 * Read helpers — defensive normalisation of stored docs
 * ------------------------------------------------------------------ */

const TRIGGER_LABELS: Record<string, string> = {
  entity_created: 'Record created',
  entity_updated: 'Record updated',
  status_changed: 'Status changed',
  stage_changed: 'Deal stage changed',
  time_elapsed: 'No activity for a while',
};

const ENTITY_LABELS: Record<string, string> = {
  lead: 'Lead',
  deal: 'Deal',
  task: 'Task',
  contact: 'Contact',
  account: 'Account',
  form_submission: 'Form submission',
};

function readTrigger(raw: unknown): SabbiginTriggerInput {
  const fallback: SabbiginTriggerInput = {
    type: 'entity_created',
    config: { entityKind: 'deal' },
  };
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const cfg = (r.config && typeof r.config === 'object'
    ? (r.config as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const type =
    typeof r.type === 'string' ? (r.type as SabbiginTriggerInput['type']) : fallback.type;
  const entityKind =
    typeof cfg.entityKind === 'string'
      ? (cfg.entityKind as SabbiginTriggerInput['config']['entityKind'])
      : fallback.config.entityKind;
  return {
    type,
    config: {
      entityKind,
      fieldName: typeof cfg.fieldName === 'string' ? cfg.fieldName : undefined,
      fromValue: cfg.fromValue != null ? String(cfg.fromValue) : undefined,
      toValue: cfg.toValue != null ? String(cfg.toValue) : undefined,
      elapsedMinutes:
        typeof cfg.elapsedMinutes === 'number' ? cfg.elapsedMinutes : undefined,
    },
  };
}

function readConditions(raw: unknown): SabbiginConditionInput[] {
  if (!Array.isArray(raw)) return [];
  const out: SabbiginConditionInput[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const obj = c as Record<string, unknown>;
    if (typeof obj.kind !== 'string') continue;
    out.push({
      kind: obj.kind as SabbiginConditionInput['kind'],
      field: typeof obj.field === 'string' ? obj.field : undefined,
      value: obj.value,
    });
  }
  return out;
}

function readActions(raw: unknown): SabbiginActionInput[] {
  if (!Array.isArray(raw)) return [];
  const out: SabbiginActionInput[] = [];
  for (const a of raw) {
    if (!a || typeof a !== 'object') continue;
    const obj = a as Record<string, unknown>;
    if (typeof obj.kind !== 'string') continue;
    out.push({
      kind: obj.kind as SabbiginActionInput['kind'],
      config:
        obj.config && typeof obj.config === 'object'
          ? (obj.config as Record<string, unknown>)
          : {},
    });
  }
  return out;
}

function triggerSummary(t: SabbiginTriggerInput): string {
  const entity = ENTITY_LABELS[t.config.entityKind] ?? t.config.entityKind;
  const base = TRIGGER_LABELS[t.type] ?? t.type;
  if (t.type === 'time_elapsed' && t.config.elapsedMinutes) {
    const days = Math.round(t.config.elapsedMinutes / (60 * 24));
    return `${entity} — no activity for ${days || 1} day${days === 1 ? '' : 's'}`;
  }
  return `${entity} · ${base}`;
}

/* --------------------------------------------------------------------
 * Actions
 * ------------------------------------------------------------------ */

export async function listSabbiginAutomations(): Promise<SabbiginAutomationRow[]> {
  const session = await getSession();
  if (!session?.user?._id) return [];
  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection(COLL)
      .find({ userId: new ObjectId(session.user._id) })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(200)
      .toArray();

    return rows.map((doc): SabbiginAutomationRow => {
      const trigger = readTrigger(doc.trigger);
      const conditions = readConditions(doc.conditions);
      const actions = readActions(doc.actions);
      const enabled =
        doc.isEnabled === true ||
        (doc.isEnabled === undefined && doc.active === true);
      const lastRunAt =
        doc.lastRunAt instanceof Date
          ? doc.lastRunAt.toISOString()
          : typeof doc.lastRunAt === 'string'
            ? doc.lastRunAt
            : null;
      const updatedAt =
        doc.updatedAt instanceof Date
          ? doc.updatedAt.toISOString()
          : typeof doc.updatedAt === 'string'
            ? doc.updatedAt
            : null;
      return {
        id: String(doc._id),
        name: typeof doc.name === 'string' ? doc.name : '(unnamed rule)',
        description:
          typeof doc.description === 'string' ? doc.description : undefined,
        enabled,
        status:
          typeof doc.status === 'string'
            ? doc.status
            : enabled
              ? 'active'
              : 'draft',
        triggerType: trigger.type,
        entityKind: trigger.config.entityKind,
        triggerSummary: triggerSummary(trigger),
        conditionCount: conditions.length,
        actionCount: actions.length,
        lastRunAt,
        updatedAt,
      };
    });
  } catch (e) {
    console.error('[listSabbiginAutomations] failed:', e);
    return [];
  }
}

export async function getSabbiginAutomation(
  id: string,
): Promise<SabbiginAutomationDetail | null> {
  const session = await getSession();
  if (!session?.user?._id) return null;
  if (!id || !ObjectId.isValid(id)) return null;
  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection(COLL).findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id),
    });
    if (!doc) return null;
    const enabled =
      doc.isEnabled === true ||
      (doc.isEnabled === undefined && doc.active === true);
    return {
      id: String(doc._id),
      name: typeof doc.name === 'string' ? doc.name : '',
      description: typeof doc.description === 'string' ? doc.description : '',
      enabled,
      status:
        typeof doc.status === 'string'
          ? doc.status
          : enabled
            ? 'active'
            : 'draft',
      trigger: readTrigger(doc.trigger),
      conditions: readConditions(doc.conditions),
      actions: readActions(doc.actions),
    };
  } catch (e) {
    console.error('[getSabbiginAutomation] failed:', e);
    return null;
  }
}

export async function saveSabbiginAutomation(
  input: SabbiginAutomationInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };

  const name = (input?.name ?? '').trim();
  if (!name) return { success: false, error: 'Rule name is required.' };
  if (!input?.trigger?.config?.entityKind)
    return { success: false, error: 'A trigger is required.' };
  if (!Array.isArray(input.actions) || input.actions.length === 0)
    return { success: false, error: 'Add at least one action.' };

  // Build the §6.7 stored shape. Strip empty optional trigger fields.
  const triggerConfig: Record<string, unknown> = {
    entityKind: input.trigger.config.entityKind,
  };
  if (input.trigger.config.fieldName)
    triggerConfig.fieldName = input.trigger.config.fieldName;
  if (input.trigger.config.fromValue)
    triggerConfig.fromValue = input.trigger.config.fromValue;
  if (input.trigger.config.toValue)
    triggerConfig.toValue = input.trigger.config.toValue;
  if (
    typeof input.trigger.config.elapsedMinutes === 'number' &&
    Number.isFinite(input.trigger.config.elapsedMinutes)
  )
    triggerConfig.elapsedMinutes = input.trigger.config.elapsedMinutes;

  const conditions = (input.conditions ?? [])
    .filter((c) => c && c.kind)
    .map((c) => ({
      kind: c.kind,
      field: c.field?.trim() || undefined,
      value: c.value,
    }));

  const actions = input.actions.map((a) => ({
    kind: a.kind,
    config: a.config ?? {},
  }));

  const enabled = input.enabled === true;
  const doc = {
    name,
    description: (input.description ?? '').trim(),
    isEnabled: enabled,
    // Master switch + lifecycle status. The engine queries
    // `{ isEnabled: true, status: 'active' }`, so keep them in lockstep.
    status: enabled ? 'active' : 'paused',
    trigger: {
      type: input.trigger.type,
      config: triggerConfig,
    },
    conditions,
    actions,
    updatedAt: new Date(),
  };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

    if (input.id && ObjectId.isValid(input.id)) {
      const res = await db
        .collection(COLL)
        .updateOne({ _id: new ObjectId(input.id), userId }, { $set: doc });
      if (res.matchedCount === 0)
        return { success: false, error: 'Rule not found.' };
      revalidatePath('/dashboard/sabbigin/automation');
      revalidatePath(`/dashboard/sabbigin/automation/${input.id}`);
      return { success: true, id: input.id };
    }

    const res = await db
      .collection(COLL)
      .insertOne({ ...doc, userId, createdAt: new Date() });
    revalidatePath('/dashboard/sabbigin/automation');
    return { success: true, id: res.insertedId.toString() };
  } catch (e: any) {
    console.error('[saveSabbiginAutomation] failed:', e);
    return { success: false, error: e?.message ?? 'Failed to save rule.' };
  }
}

export async function toggleSabbiginAutomation(
  id: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  if (!id || !ObjectId.isValid(id))
    return { success: false, error: 'Invalid rule id' };
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection(COLL).updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(session.user._id) },
      {
        $set: {
          isEnabled: enabled,
          status: enabled ? 'active' : 'paused',
          updatedAt: new Date(),
        },
      },
    );
    if (res.matchedCount === 0)
      return { success: false, error: 'Rule not found.' };
    revalidatePath('/dashboard/sabbigin/automation');
    return { success: true };
  } catch (e: any) {
    console.error('[toggleSabbiginAutomation] failed:', e);
    return { success: false, error: e?.message ?? 'Failed to toggle rule.' };
  }
}

export async function deleteSabbiginAutomation(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  if (!id || !ObjectId.isValid(id))
    return { success: false, error: 'Invalid rule id' };
  try {
    const { db } = await connectToDatabase();
    const res = await db
      .collection(COLL)
      .deleteOne({ _id: new ObjectId(id), userId: new ObjectId(session.user._id) });
    if (res.deletedCount === 0)
      return { success: false, error: 'Rule not found.' };
    revalidatePath('/dashboard/sabbigin/automation');
    return { success: true };
  } catch (e: any) {
    console.error('[deleteSabbiginAutomation] failed:', e);
    return { success: false, error: e?.message ?? 'Failed to delete rule.' };
  }
}
