'use server';

/**
 * Wachat project-attributes server actions.
 *
 * Thin shims around the `wachat-project-attributes` Rust crate (mounted at
 * `/v1/wachat/project-attributes`), which owns the read/replace of the
 * embedded `projects.userAttributes[]` array. These actions back
 * `src/app/wachat/settings/attributes/page.tsx` (the `UserAttributesSettingsTab`),
 * superseding the legacy native-Mongo `handleSaveUserAttributes` +
 * `getProjectById().userAttributes` read leg.
 *
 * The Rust crate is imported DIRECTLY (not via the `rustClient` barrel) per
 * the wiring brief — `src/lib/rust-client/index.ts` is intentionally left
 * untouched.
 */

import { revalidatePath } from 'next/cache';

import {
    wachatProjectAttributesApi,
    type WachatUserAttribute,
} from '@/lib/rust-client/wachat-project-attributes';
import { getErrorMessage } from '@/lib/utils';

const ATTRIBUTES_PATH = '/wachat/settings/attributes';

/** Allowed `dataType` values (matches the Rust handler + the UI `<Select>`). */
const ALLOWED_DATA_TYPES = ['TEXT', 'NUMBER', 'BOOLEAN', 'DATE'] as const;
/** Allowed `status` values (matches the Rust handler + the legacy type). */
const ALLOWED_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export interface GetProjectAttributesResult {
    attributes?: WachatUserAttribute[];
    error?: string;
}

export interface SaveProjectAttributesResult {
    success?: boolean;
    error?: string;
}

/**
 * GET the project's `userAttributes[]`.
 *
 * Owner-or-agent scoping is enforced server-side by the Rust crate; a
 * missing/forbidden project collapses to a `404` (surfaced here as an error).
 */
export async function getProjectAttributes(
    projectId: string,
): Promise<GetProjectAttributesResult> {
    if (!projectId) return { error: 'Project ID is required.' };
    try {
        const r = await wachatProjectAttributesApi.list(projectId);
        return { attributes: r.attributes ?? [] };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * PATCH the project's `userAttributes[]` — full-array replace.
 *
 * Validates name/dataType/status client-side before hitting Rust (the crate
 * re-validates authoritatively). Mirrors the legacy `handleSaveUserAttributes`
 * contract: `{ success }` on the happy path, `{ error }` otherwise.
 */
export async function saveProjectAttributes(
    projectId: string,
    attributes: WachatUserAttribute[],
): Promise<SaveProjectAttributesResult> {
    if (!projectId) return { error: 'Project ID is required.' };
    if (!Array.isArray(attributes)) return { error: 'Attributes must be a list.' };

    // Validate + normalize each row before the round trip.
    const cleaned: WachatUserAttribute[] = [];
    for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i];
        const name = (attr?.name ?? '').trim();
        if (!name) {
            return { error: `Attribute #${i + 1} is missing a name.` };
        }
        const dataType = attr?.dataType;
        if (!ALLOWED_DATA_TYPES.includes(dataType as (typeof ALLOWED_DATA_TYPES)[number])) {
            return {
                error: `Attribute "${name}" has an invalid data type (must be one of ${ALLOWED_DATA_TYPES.join(', ')}).`,
            };
        }
        const status = attr?.status;
        if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
            return {
                error: `Attribute "${name}" has an invalid status (must be one of ${ALLOWED_STATUSES.join(', ')}).`,
            };
        }
        const webhookKey = (attr?.webhookKey ?? '').toString().trim();
        cleaned.push({
            id: attr?.id || undefined,
            name,
            dataType,
            webhookKey: webhookKey || null,
            status,
        });
    }

    try {
        const r = await wachatProjectAttributesApi.replace(projectId, cleaned);
        revalidatePath(ATTRIBUTES_PATH);
        return { success: r.success };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
