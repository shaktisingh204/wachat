'use server';

/**
 * Wachat A/B-testing server actions — backs `/wachat/campaign-ab-test`.
 *
 * The Rust crate `wachat-ab-testing` (mounted at `/v1/wachat/ab-tests`)
 * owns the test config + a zeroed per-variant results scaffold. It does
 * NOT send anything. So `createAbTest` here does two things:
 *
 *   1. persists the test config via `wachatAbTestingApi.create`, then
 *   2. fires the real split broadcast via
 *      `rustClient.wachatBroadcast.bulkStart` — variant A to `splitPct`
 *      of the audience, variant B to the remainder.
 *
 * Results stay zero until the broadcast webhook populates
 * `wa_ab_test_results`.
 *
 * NOTE: imports `wachatAbTestingApi` DIRECTLY from its module (the crate
 * is not yet registered on the `rustClient` barrel).
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import {
    wachatAbTestingApi,
    type CreateTestBody,
    type VariantInput,
} from '@/lib/rust-client/wachat-ab-testing';
import type { ContactRecord } from '@/lib/rust-client/wachat-broadcast';
import { getErrorMessage } from '@/lib/utils';

const PAGE_PATH = '/wachat/campaign-ab-test';

/** Default template language for the split broadcast (Meta language code). */
const DEFAULT_LANGUAGE = 'en_US';

interface VariantInputPayload {
    name: string;
    templateId?: string | null;
}

export interface CreateAbTestInput {
    projectId: string;
    name: string;
    variantA: VariantInputPayload;
    variantB: VariantInputPayload;
    splitPct: number;
    audience: string;
    phoneNumberId?: string | null;
}

/**
 * Map a raw contact doc (from `wachatContactsApi.list`) into the
 * `ContactRecord` shape `bulkStart` expects. Mirrors the coercion the
 * legacy broadcast actions do for loosely-typed Mongo rows.
 */
function toContactRecord(c: Record<string, unknown>): ContactRecord | null {
    const rawPhone =
        c.phone ?? c.waId ?? c.wa_id ?? (c as { Phone?: unknown }).Phone ?? '';
    const phone = String(rawPhone ?? '').trim();
    if (!phone) return null;
    const name = c.name ? String(c.name) : 'Subscriber';
    return { phone, name };
}

// =================================================================
//  LIST
// =================================================================

export async function listAbTests(projectId: string) {
    if (!projectId) return { error: 'Project ID is required.' };
    try {
        const r = await wachatAbTestingApi.list(projectId);
        return { tests: r.tests };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  GET (detail + per-variant results)
// =================================================================

export async function getAbTest(testId: string) {
    if (!testId) return { error: 'Test ID is required.' };
    try {
        const r = await wachatAbTestingApi.get(testId);
        return { test: r.test, variants: r.variants };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  CREATE (+ launch the real split broadcast)
// =================================================================

export async function createAbTest(input: CreateAbTestInput) {
    const projectId = (input.projectId ?? '').trim();
    const name = (input.name ?? '').trim();
    const splitPct = Number(input.splitPct);
    const audience = (input.audience ?? '').trim();
    const variantA = input.variantA;
    const variantB = input.variantB;

    // ---- Validation (mirrors the Rust `validate_create` guard) ----
    if (!projectId) return { error: 'Project ID is required.' };
    if (!name) return { error: 'Test name is required.' };
    if (!variantA?.name?.trim() || !variantB?.name?.trim()) {
        return { error: 'Both variant templates are required.' };
    }
    if (
        variantA.name.trim() === variantB.name.trim() &&
        (variantA.templateId ?? null) === (variantB.templateId ?? null)
    ) {
        return { error: 'Variant A and Variant B must use different templates.' };
    }
    if (!Number.isFinite(splitPct) || splitPct < 10 || splitPct > 90) {
        return { error: 'Split must be between 10 and 90.' };
    }
    if (!audience) return { error: 'Audience is required.' };

    const variantAInput: VariantInput = {
        name: variantA.name.trim(),
        templateId: variantA.templateId ?? null,
    };
    const variantBInput: VariantInput = {
        name: variantB.name.trim(),
        templateId: variantB.templateId ?? null,
    };

    // ---- 1. Persist the test config + zeroed results scaffold (Rust). ----
    const body: CreateTestBody = {
        projectId,
        name,
        variantA: variantAInput,
        variantB: variantBInput,
        splitPct,
        audience,
        phoneNumberId: input.phoneNumberId ?? null,
    };

    let test;
    try {
        test = await wachatAbTestingApi.create(body);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }

    // ---- 2. Resolve the audience contacts and split A / B. ----
    let contacts: ContactRecord[] = [];
    try {
        const list = await rustClient.wachatContacts.list({ projectId });
        contacts = (list.contacts ?? [])
            .map((c) => toContactRecord(c as Record<string, unknown>))
            .filter((c): c is ContactRecord => c !== null);
    } catch (e) {
        // The test row is persisted; surface a partial-success so the UI
        // shows the test but flags that the broadcast didn't go out.
        return {
            test,
            warning: `Test saved, but loading the audience failed: ${getErrorMessage(e)}`,
        };
    }

    if (contacts.length === 0) {
        return {
            test,
            warning: 'Test saved, but no contacts were found to broadcast to.',
        };
    }

    const cutoff = Math.round((contacts.length * splitPct) / 100);
    const groupA = contacts.slice(0, cutoff);
    const groupB = contacts.slice(cutoff);

    // ---- 3. Fire the real split broadcast, one bulkStart per variant. ----
    try {
        const launches: Promise<unknown>[] = [];
        if (groupA.length > 0) {
            launches.push(
                rustClient.wachatBroadcast.bulkStart({
                    projectIds: [projectId],
                    templateName: variantAInput.name,
                    language: DEFAULT_LANGUAGE,
                    fileName: `ab-test-${name}-variant-A`,
                    contacts: groupA,
                }),
            );
        }
        if (groupB.length > 0) {
            launches.push(
                rustClient.wachatBroadcast.bulkStart({
                    projectIds: [projectId],
                    templateName: variantBInput.name,
                    language: DEFAULT_LANGUAGE,
                    fileName: `ab-test-${name}-variant-B`,
                    contacts: groupB,
                }),
            );
        }
        await Promise.all(launches);
    } catch (e) {
        return {
            test,
            warning: `Test saved, but launching the broadcast failed: ${getErrorMessage(e)}`,
        };
    }

    revalidatePath(PAGE_PATH);
    return {
        test,
        message: `A/B test launched — ${groupA.length} to variant A, ${groupB.length} to variant B.`,
    };
}

// =================================================================
//  STOP
// =================================================================

export async function stopAbTest(testId: string) {
    if (!testId) return { success: false, error: 'Test ID is required.' };
    try {
        const r = await wachatAbTestingApi.stop(testId);
        revalidatePath(PAGE_PATH);
        return { success: r.success };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// =================================================================
//  PROMOTE WINNER
// =================================================================

export async function promoteAbTestWinner(testId: string, winnerVariant: 'A' | 'B') {
    if (!testId) return { success: false, error: 'Test ID is required.' };
    if (winnerVariant !== 'A' && winnerVariant !== 'B') {
        return { success: false, error: "Winner must be 'A' or 'B'." };
    }
    try {
        const r = await wachatAbTestingApi.promoteWinner(testId, { winnerVariant });
        revalidatePath(PAGE_PATH);
        return { success: r.success };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// =================================================================
//  DELETE
// =================================================================

export async function deleteAbTest(testId: string) {
    if (!testId) return { success: false, error: 'Test ID is required.' };
    try {
        const r = await wachatAbTestingApi.delete(testId);
        revalidatePath(PAGE_PATH);
        return { success: r.success };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
