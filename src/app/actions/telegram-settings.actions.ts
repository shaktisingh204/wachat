'use server';

/**
 * Server-action wrappers for the Telegram project-level + per-bot
 * policy layer exposed by `/v1/telegram/settings`.
 *
 * The Rust client itself is server-only; the dashboard settings page
 * (a client component) reaches the API through these actions.
 */

import { revalidatePath } from 'next/cache';

import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    AckResult,
    AuditListResp,
    EffectiveResp,
    GdprListResp,
    OverridesResp,
    ProjectResp,
    ProjectSettings,
    TestHoursResp,
} from '@/lib/rust-client/telegram-settings';

const PAGE = '/dashboard/telegram/settings';

function fail<T extends object>(empty: T, err: unknown): T & { error: string } {
    const msg = err instanceof RustApiError ? err.message : String(err);
    return { ...empty, error: msg };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getTelegramProjectSettingsAction(
    projectId: string,
): Promise<ProjectResp> {
    try {
        return await rustClient.telegramSettings.getProject(projectId);
    } catch (e) {
        return fail({} as ProjectResp, e);
    }
}

export async function getTelegramEffectiveSettingsAction(
    projectId: string,
    botId?: string,
): Promise<EffectiveResp> {
    try {
        return await rustClient.telegramSettings.getEffective(projectId, botId);
    } catch (e) {
        return fail({} as EffectiveResp, e);
    }
}

export async function getTelegramBotOverridesAction(
    projectId: string,
    botId: string,
): Promise<OverridesResp> {
    try {
        return await rustClient.telegramSettings.getOverrides(projectId, botId);
    } catch (e) {
        return fail({} as OverridesResp, e);
    }
}

export async function listTelegramGdprRequestsAction(
    projectId: string,
): Promise<GdprListResp> {
    try {
        return await rustClient.telegramSettings.listGdprRequests(projectId);
    } catch (e) {
        return fail({ requests: [] } as GdprListResp, e);
    }
}

export async function listTelegramSettingsAuditAction(
    projectId: string,
    opts: { cursor?: string; limit?: number } = {},
): Promise<AuditListResp> {
    try {
        return await rustClient.telegramSettings.audit(projectId, opts);
    } catch (e) {
        return fail({ rows: [] } as AuditListResp, e);
    }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function saveTelegramProjectSettingsAction(
    projectId: string,
    body: ProjectSettings,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramSettings.putProject(projectId, body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function saveTelegramBotOverridesAction(
    projectId: string,
    botId: string,
    overrides: Record<string, unknown>,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramSettings.putOverrides(
            projectId,
            botId,
            overrides,
        );
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function clearTelegramBotOverridesAction(
    projectId: string,
    botId: string,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramSettings.deleteOverrides(projectId, botId);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function testTelegramBusinessHoursAction(
    projectId: string,
    body: { timestamp?: string; botId?: string },
): Promise<TestHoursResp> {
    try {
        return await rustClient.telegramSettings.testOutOfHours(projectId, body);
    } catch (e) {
        return fail(
            { within_business_hours: false, timestamp: '' } as TestHoursResp,
            e,
        );
    }
}

export async function requestTelegramDataExportAction(
    projectId: string,
    reason?: string,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramSettings.exportData(projectId, reason);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function requestTelegramDataDeletionAction(
    projectId: string,
    confirm: string,
    reason?: string,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramSettings.deleteData(
            projectId,
            confirm,
            reason,
        );
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}
