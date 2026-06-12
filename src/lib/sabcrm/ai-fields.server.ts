import 'server-only';

/**
 * SabCRM AI computed fields — evaluator core (server side).
 *
 * Shared by the scheduler pass (`scheduler.ts`, pass 6) and the manual
 * recompute action (`src/app/actions/sabcrm-ai.actions.ts`). The pure helpers
 * (`aiSourceFields`, `aiInputsHash`, `coerceAiOutput`, `AI_FIELD_SYSTEM`) live
 * in `./ai-fields` so the unit tests can import them without this module's
 * `'server-only'` / Mongo graph — this file re-exports them, so callers only
 * ever import from here.
 *
 * ## Storage envelope (see docs/sabcrm/rnd/intelligence.md §A2)
 *
 * The generated value is a PLAIN SCALAR at `data[field.key]` (string / number
 * / boolean) so the records engine's filter/sort/group tree keeps working with
 * zero engine change. Computation metadata rides the reserved
 * `data.__ai.<fieldKey>` subkey:
 *
 *   { inputsHash, computedAt, status: 'pending'|'ready'|'failed', error }
 *
 * Rules:
 *  - `__ai` is a system namespace — only ever `$set` dotted
 *    `data.__ai.<fieldKey>` subkeys, never replace the whole map.
 *  - Writes go DIRECT to Mongo (`sabcrm_records`) and deliberately do NOT
 *    bump the record's top-level `updatedAt` — an AI write must not reset the
 *    `time.elapsed` / deal-rotting idle clocks or re-trigger record-change
 *    workflows (same rationale as the rotting-tag design in scheduler.ts).
 */

import { ObjectId, type Db } from 'mongodb';

import { rustServiceFetch } from '@/lib/rust-client/service-fetch';
import type { FieldMetadata } from './types';
import { aiFieldConfig } from './types';
import {
  AI_FIELD_SYSTEM,
  coerceAiOutput,
  type AiFieldEvalResult,
} from './ai-fields';

export {
  AI_FIELD_SYSTEM,
  aiSourceFields,
  aiSourceValue,
  aiInputsHash,
  coerceAiOutput,
  type AiFieldEvalResult,
} from './ai-fields';

/** Mongo collection holding CRM records (mirrors scheduler.ts). */
const RECORDS_COLL = 'sabcrm_records';

/** The `{ subject?, body }` envelope `/templates/preview` renders to. */
interface RenderedTemplate {
  subject?: string;
  body?: string;
}

/**
 * Persist the per-field AI meta (and optionally the scalar value) directly on
 * the record — dotted `$set` paths only, no `updatedAt` bump. Best-effort.
 */
async function writeAiState(
  db: Db,
  projectId: string,
  recordId: string,
  fieldKey: string,
  inputsHash: string,
  outcome:
    | { status: 'ready'; value: unknown }
    | { status: 'failed'; error: string },
): Promise<void> {
  if (!ObjectId.isValid(recordId)) return;
  const meta = {
    inputsHash,
    computedAt: new Date().toISOString(),
    status: outcome.status,
    error: outcome.status === 'failed' ? outcome.error : null,
  };
  const set: Record<string, unknown> = { [`data.__ai.${fieldKey}`]: meta };
  if (outcome.status === 'ready') set[`data.${fieldKey}`] = outcome.value;
  await db
    .collection(RECORDS_COLL)
    .updateOne({ _id: new ObjectId(recordId), projectId }, { $set: set });
}

/**
 * Full single-record evaluation:
 *
 *  1. render the prompt via the `sabcrm-templates` `{{variable}}` engine
 *     (`POST /v1/sabcrm/templates/preview` — the exact call shape of
 *     `renderSequenceEmail` in scheduler.ts);
 *  2. call {@link generateSabcrmText} with the {@link AI_FIELD_SYSTEM} system
 *     prompt (SELECT appends the allowed option list to the user prompt);
 *  3. coerce by `settings.ai.outputType` and `$set` `data.<key>` +
 *     `data.__ai.<key>` directly on `sabcrm_records` (no `updatedAt` bump).
 *
 * `UNKNOWN` replies → `status:'failed'` with the value left untouched.
 * Never throws — every failure lands on the record meta AND in the result.
 */
export async function evaluateAiField(args: {
  /** From `connectToDatabase()`. */
  db: Db;
  projectId: string;
  objectSlug: string;
  /** Type 'AI'; config pre-parsed by the caller. */
  field: FieldMetadata;
  recordId: string;
  /** Precomputed by the caller (it is the claim key). */
  inputsHash: string;
}): Promise<AiFieldEvalResult> {
  const { db, projectId, objectSlug, field, recordId, inputsHash } = args;
  try {
    const cfg = aiFieldConfig(field);
    if (!cfg) {
      return { status: 'skipped', detail: 'field has no valid AI config' };
    }

    // 1. Render the prompt template against the record (sibling-field values).
    let rendered: string;
    try {
      const out = await rustServiceFetch<RenderedTemplate>(
        '/v1/sabcrm/templates/preview',
        {
          projectId,
          method: 'POST',
          body: JSON.stringify({
            projectId,
            body: cfg.prompt,
            object: objectSlug,
            recordId,
          }),
        },
      );
      rendered = typeof out.body === 'string' ? out.body : cfg.prompt;
    } catch (e) {
      const detail = `prompt render failed: ${
        e instanceof Error ? e.message : String(e)
      }`;
      await writeAiState(db, projectId, recordId, field.key, inputsHash, {
        status: 'failed',
        error: detail,
      });
      return { status: 'failed', detail };
    }

    // 2. SELECT fields tell the model exactly which values are allowed.
    let prompt = rendered;
    if (cfg.outputType === 'SELECT') {
      const allowed = (field.options ?? [])
        .map((o) => `${o.label} (${o.value})`)
        .join(', ');
      prompt += `\n\nAllowed values: ${allowed}`;
    }

    const { generateSabcrmText } = await import('./ai-llm.server');
    const llm = await generateSabcrmText({ system: AI_FIELD_SYSTEM, prompt });
    if (!llm.ok) {
      await writeAiState(db, projectId, recordId, field.key, inputsHash, {
        status: 'failed',
        error: llm.error,
      });
      return { status: 'failed', detail: llm.error };
    }

    if (llm.text.trim().toUpperCase() === 'UNKNOWN') {
      const detail = 'model could not determine a value';
      await writeAiState(db, projectId, recordId, field.key, inputsHash, {
        status: 'failed',
        error: detail,
      });
      return { status: 'failed', detail };
    }

    // 3. Coerce + persist.
    const coerced = coerceAiOutput(llm.text, field);
    if (coerced.status !== 'ready') {
      const detail = coerced.detail ?? 'could not coerce the model output';
      await writeAiState(db, projectId, recordId, field.key, inputsHash, {
        status: 'failed',
        error: detail,
      });
      return { status: 'failed', detail };
    }

    await writeAiState(db, projectId, recordId, field.key, inputsHash, {
      status: 'ready',
      value: coerced.value,
    });
    return coerced;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    try {
      await writeAiState(db, projectId, recordId, field.key, inputsHash, {
        status: 'failed',
        error: detail,
      });
    } catch {
      /* best-effort — the report line still carries the failure */
    }
    return { status: 'failed', detail };
  }
}
