'use server';

/**
 * Server-action wrappers for the rule-based Telegram auto-reply engine
 * exposed by `/v1/telegram/auto-reply`. The dashboard page calls these
 * from a client component — the Rust client itself is server-only.
 */

import { revalidatePath } from 'next/cache';

import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    AckResult,
    ConflictsResp,
    GetResp,
    ListQuery,
    ListResp,
    MatchBody,
    MatchResp,
    ReorderBody,
    RunsResp,
    TestBody,
    TestResp,
    UpsertBody,
} from '@/lib/rust-client/telegram-auto-reply';

function fail<T extends object>(empty: T, err: unknown): T & { error: string } {
    const msg = err instanceof RustApiError ? err.message : String(err);
    return { ...empty, error: msg };
}

const PAGE = '/dashboard/telegram/auto-reply';

// ---------------------------------------------------------------------------
//  Read
// ---------------------------------------------------------------------------

export async function listAutoReplyRulesAction(q: ListQuery): Promise<ListResp> {
    try {
        return await rustClient.telegramAutoReply.list(q);
    } catch (e) {
        return fail(
            {
                rules: [],
                total: 0,
                page: q.page ?? 1,
                pageSize: q.pageSize ?? 50,
            } as ListResp,
            e,
        );
    }
}

export async function getAutoReplyRuleAction(
    ruleId: string,
    projectId: string,
): Promise<GetResp> {
    try {
        return await rustClient.telegramAutoReply.get(ruleId, projectId);
    } catch (e) {
        return fail({} as GetResp, e);
    }
}

export async function listAutoReplyRunsAction(
    ruleId: string,
    projectId: string,
    opts: { cursor?: string; limit?: number } = {},
): Promise<RunsResp> {
    try {
        return await rustClient.telegramAutoReply.runs(ruleId, projectId, opts);
    } catch (e) {
        return fail({ runs: [] } as RunsResp, e);
    }
}

export async function getAutoReplyConflictsAction(
    projectId: string,
): Promise<ConflictsResp> {
    try {
        return await rustClient.telegramAutoReply.conflicts(projectId);
    } catch (e) {
        return fail({ pairs: [] } as ConflictsResp, e);
    }
}

// ---------------------------------------------------------------------------
//  Write
// ---------------------------------------------------------------------------

export async function createAutoReplyRuleAction(body: UpsertBody): Promise<AckResult> {
    try {
        const res = await rustClient.telegramAutoReply.create(body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function updateAutoReplyRuleAction(
    ruleId: string,
    body: UpsertBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramAutoReply.update(ruleId, body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function deleteAutoReplyRuleAction(
    ruleId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramAutoReply.delete(ruleId, projectId);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function setAutoReplyRuleStatusAction(
    ruleId: string,
    projectId: string,
    enabled: boolean,
): Promise<AckResult> {
    try {
        const res = enabled
            ? await rustClient.telegramAutoReply.enable(ruleId, projectId)
            : await rustClient.telegramAutoReply.disable(ruleId, projectId);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function reorderAutoReplyRulesAction(
    body: ReorderBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramAutoReply.reorder(body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (e) {
        return fail({ success: false } as AckResult, e);
    }
}

export async function testAutoReplyRuleAction(
    ruleId: string,
    body: TestBody,
): Promise<TestResp> {
    try {
        return await rustClient.telegramAutoReply.test(ruleId, body);
    } catch (e) {
        return fail(
            { matched: false, actionsThatWouldFire: [], steps: [] } as TestResp,
            e,
        );
    }
}

export async function matchAutoReplyRulesAction(body: MatchBody): Promise<MatchResp> {
    try {
        return await rustClient.telegramAutoReply.match(body);
    } catch (e) {
        return fail({ matched: [] } as MatchResp, e);
    }
}


