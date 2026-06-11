'use server';

/**
 * SabSheet AI — server actions ("AI in cells", Superpower B).
 *
 * Each action: (1) authenticates via getSession, (2) gates the call on the
 * tenant's `ai_requests` entitlement with `canUse`, (3) runs the genkit flow,
 * (4) records consumption with `recordUsage` using a deterministic idempotency
 * key derived from the inputs (so a retried/duplicated submit is not double-billed).
 *
 * Multi-tenant: the tenant id is the session user's `_id`, matching the
 * tenant-scoping convention used across the other server actions.
 */

import { createHash } from 'crypto';
import { getSession } from './user.actions';
import { canUse } from '@/lib/billing/entitlements';
import { recordUsage } from '@/lib/billing/usage-meter';
import {
    sabsheetFormulaGen,
    type SabsheetFormulaGenOutput,
} from '@/ai/flows/sabsheet-formula-gen';
import {
    sabsheetExplainFormula,
    type SabsheetExplainFormulaOutput,
} from '@/ai/flows/sabsheet-explain-formula';
import {
    sabsheetColumnTransform,
    type SabsheetColumnTransformOutput,
} from '@/ai/flows/sabsheet-column-transform';

export interface SabsheetAiError {
    error: string;
}

function hashKey(prefix: string, payload: unknown): string {
    const h = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
    return `sabsheet-ai:${prefix}:${h}`;
}

/**
 * Resolve the calling tenant + gate on the AI quota. Returns the tenantId on
 * success or a typed error shape the caller can return verbatim.
 */
async function authorizeAi(): Promise<{ tenantId: string } | SabsheetAiError> {
    const session = await getSession();
    if (!session?.user?._id) {
        return { error: 'Not authenticated' };
    }
    const tenantId = String(session.user._id);

    const allowed = await canUse(tenantId, 'ai_requests');
    if (!allowed) {
        return { error: 'AI quota exceeded' };
    }
    return { tenantId };
}

/** NL → spreadsheet formula. */
export async function generateFormulaAction(
    prompt: string,
    sheetSchema?: string,
): Promise<SabsheetFormulaGenOutput | SabsheetAiError> {
    const auth = await authorizeAi();
    if ('error' in auth) return auth;

    try {
        const result = await sabsheetFormulaGen({ prompt, sheetSchema });

        await recordUsage({
            tenantId: auth.tenantId,
            feature: 'ai_requests',
            units: 1,
            idempotencyKey: hashKey('formula-gen', { prompt, sheetSchema }),
            meta: { feature: 'sabsheet', op: 'generateFormula' },
        });

        return result;
    } catch (err) {
        console.error('[sabsheet-ai] generateFormulaAction failed:', err);
        return { error: 'Failed to generate formula' };
    }
}

/** Explain an existing formula in plain English. */
export async function explainFormulaAction(
    formula: string,
): Promise<SabsheetExplainFormulaOutput | SabsheetAiError> {
    const auth = await authorizeAi();
    if ('error' in auth) return auth;

    try {
        const result = await sabsheetExplainFormula({ formula });

        await recordUsage({
            tenantId: auth.tenantId,
            feature: 'ai_requests',
            units: 1,
            idempotencyKey: hashKey('explain', { formula }),
            meta: { feature: 'sabsheet', op: 'explainFormula' },
        });

        return result;
    } catch (err) {
        console.error('[sabsheet-ai] explainFormulaAction failed:', err);
        return { error: 'Failed to explain formula' };
    }
}

/** Transform a column of values per a natural-language instruction. */
export async function transformColumnAction(
    instruction: string,
    values: string[],
): Promise<SabsheetColumnTransformOutput | SabsheetAiError> {
    const auth = await authorizeAi();
    if ('error' in auth) return auth;

    try {
        const result = await sabsheetColumnTransform({ instruction, values });

        await recordUsage({
            tenantId: auth.tenantId,
            feature: 'ai_requests',
            units: 1,
            idempotencyKey: hashKey('column-transform', { instruction, values }),
            meta: { feature: 'sabsheet', op: 'transformColumn', rows: values.length },
        });

        return result;
    } catch (err) {
        console.error('[sabsheet-ai] transformColumnAction failed:', err);
        return { error: 'Failed to transform column' };
    }
}
