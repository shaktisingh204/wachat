/**
 * Client for `/v1/telegram/auto-reply`. Server-only.
 *
 * Multi-tenant rule-based auto-reply engine — every call carries a
 * `projectId` so the Rust BFF can enforce tenant isolation via
 * `require_project`. A rule may target a specific bot (`botId`) or
 * apply project-wide (`botId === null`).
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/auto-reply';

// ---------------------------------------------------------------------------
//  Common shapes
// ---------------------------------------------------------------------------

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    ruleId?: string;
}

export type TriggerKind =
    | 'keyword'
    | 'regex'
    | 'exact'
    | 'contains_any'
    | 'starts_with'
    | 'business_hours'
    | 'first_message'
    | 'media_only';

export interface RuleTrigger {
    kind: TriggerKind;
    /** Shape depends on kind — string / string[] / { startHour, endHour, weekdays[] } / null. */
    payload?: unknown;
    caseSensitive?: boolean;
    languageCode?: string;
}

export type ConditionKind =
    | 'has_media'
    | 'is_group'
    | 'is_private'
    | 'contact_has_tag'
    | 'time_window'
    | 'sender_role';

export interface RuleCondition {
    kind: ConditionKind;
    payload?: unknown;
}

export type ActionKind =
    | 'reply_text'
    | 'reply_media'
    | 'forward_to_chat'
    | 'tag_contact'
    | 'remove_tag'
    | 'assign_agent'
    | 'run_flow'
    | 'do_nothing'
    | 'set_variable'
    | 'http_call';

export interface RuleAction {
    kind: ActionKind;
    payload?: unknown;
}

export interface Cooldown {
    perChatSeconds?: number;
    perRuleSeconds?: number;
    perDayLimit?: number;
}

export interface RuleRow {
    _id: string;
    projectId: string;
    botId?: string | null;
    name: string;
    status: 'enabled' | 'disabled';
    priority: number;
    trigger: RuleTrigger;
    conditions: RuleCondition[];
    actions: RuleAction[];
    cooldown: Cooldown;
    runCount: number;
    errorCount: number;
    lastRunAt?: string;
    fired7d: number;
    createdAt: string;
    updatedAt: string;
}

// ---------------------------------------------------------------------------
//  List
// ---------------------------------------------------------------------------

export interface ListQuery {
    projectId: string;
    botId?: string;
    status?: 'enabled' | 'disabled';
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface ListResp {
    rules: RuleRow[];
    total: number;
    page: number;
    pageSize: number;
    error?: string;
}

// ---------------------------------------------------------------------------
//  Create / update
// ---------------------------------------------------------------------------

export interface UpsertBody {
    projectId: string;
    botId?: string | null;
    name: string;
    status?: 'enabled' | 'disabled';
    priority?: number;
    trigger: RuleTrigger;
    conditions?: RuleCondition[];
    actions?: RuleAction[];
    cooldown?: Cooldown;
}

export interface GetResp {
    rule?: RuleRow;
    error?: string;
}

// ---------------------------------------------------------------------------
//  Test
// ---------------------------------------------------------------------------

export interface SimulatedMessage {
    text?: string;
    hasMedia?: boolean;
    isGroup?: boolean;
    chatId?: string;
    fromUserId?: string;
    senderTag?: string;
    senderRole?: string;
    languageCode?: string;
    isFirstMessage?: boolean;
}

export interface TestBody {
    projectId: string;
    simulatedMessage?: SimulatedMessage;
}

export interface EvalStep {
    stage: string;
    label: string;
    passed: boolean;
    detail?: string;
}

export interface TestResp {
    matched: boolean;
    actionsThatWouldFire: RuleAction[];
    steps: EvalStep[];
    error?: string;
}

// ---------------------------------------------------------------------------
//  Reorder / runs / match / conflicts
// ---------------------------------------------------------------------------

export interface ReorderBody {
    projectId: string;
    orderedIds: string[];
}

export interface RunRow {
    _id: string;
    ruleId: string;
    projectId: string;
    botId?: string;
    chatId?: string;
    triggerSummary: string;
    actionsCount: number;
    status: string;
    firedAt: string;
}

export interface RunsResp {
    runs: RunRow[];
    nextCursor?: string;
    error?: string;
}

export interface MatchUpdate {
    text?: string;
    hasMedia?: boolean;
    isGroup?: boolean;
    chatId?: string;
    fromUserId?: string;
    senderTag?: string;
    senderRole?: string;
    languageCode?: string;
    isFirstMessage?: boolean;
}

export interface MatchBody {
    projectId: string;
    botId?: string;
    update: MatchUpdate;
}

export interface MatchedRule {
    ruleId: string;
    name: string;
    priority: number;
    actions: RuleAction[];
}

export interface MatchResp {
    matched: MatchedRule[];
    error?: string;
}

export interface ConflictPair {
    ruleAId: string;
    ruleAName: string;
    ruleBId: string;
    ruleBName: string;
    reason: string;
}

export interface ConflictsResp {
    pairs: ConflictPair[];
    error?: string;
}

// ---------------------------------------------------------------------------
//  Wire helpers
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined | null>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? `?${parts.join('&')}` : '';
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
//  Legacy compat shapes — kept for the older server actions in
//  `src/app/actions/telegram.actions.ts`. New code MUST use the typed
//  list/create/update/delete/enable/disable methods above.
// ---------------------------------------------------------------------------

/** @deprecated use {@link UpsertBody} */
export interface LegacyUpsertBody {
    botId: string;
    ruleId?: string;
    name: string;
    trigger: unknown;
    pattern?: string;
    caseSensitive?: boolean;
    matchMode?: string;
    response: unknown;
    isActive?: boolean;
    priority?: number;
    insideBusinessHoursOnly?: boolean;
}

export const telegramAutoReplyApi = {
    /** `GET /v1/telegram/auto-reply/` — accepts either a botId string (legacy)
     *  or a full {@link ListQuery}. The legacy form is preserved so older
     *  server actions keep compiling; new code MUST pass a `ListQuery`. */
    list: (q: ListQuery | string) => {
        if (typeof q === 'string') {
            return rustFetch<ListResp & { rules: RuleRow[] }>(
                `${BASE}/${qs({ botId: q })}`,
            );
        }
        return rustFetch<ListResp>(
            `${BASE}/${qs({
                projectId: q.projectId,
                botId: q.botId,
                status: q.status,
                search: q.search,
                page: q.page,
                pageSize: q.pageSize,
            })}`,
        );
    },

    /** `POST /v1/telegram/auto-reply/` */
    create: (body: UpsertBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `GET /v1/telegram/auto-reply/{ruleId}` */
    get: (ruleId: string, projectId: string) =>
        rustFetch<GetResp>(
            `${BASE}/${encodeURIComponent(ruleId)}${qs({ projectId })}`,
        ),

    /** `PUT /v1/telegram/auto-reply/{ruleId}` */
    update: (ruleId: string, body: UpsertBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(ruleId)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),

    /** `DELETE /v1/telegram/auto-reply/{ruleId}` */
    delete: (ruleId: string, projectId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(ruleId)}${qs({ projectId })}`,
            { method: 'DELETE' },
        ),

    /** `POST /v1/telegram/auto-reply/{ruleId}/enable` */
    enable: (ruleId: string, projectId: string) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(ruleId)}/enable`, {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        }),

    /** `POST /v1/telegram/auto-reply/{ruleId}/disable` */
    disable: (ruleId: string, projectId: string) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(ruleId)}/disable`, {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        }),

    /** `POST /v1/telegram/auto-reply/{ruleId}/test` */
    test: (ruleId: string, body: TestBody) =>
        rustFetch<TestResp>(`${BASE}/${encodeURIComponent(ruleId)}/test`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `POST /v1/telegram/auto-reply/reorder` */
    reorder: (body: ReorderBody) =>
        rustFetch<AckResult>(`${BASE}/reorder`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `GET /v1/telegram/auto-reply/{ruleId}/runs` */
    runs: (
        ruleId: string,
        projectId: string,
        opts: { cursor?: string; limit?: number } = {},
    ) =>
        rustFetch<RunsResp>(
            `${BASE}/${encodeURIComponent(ruleId)}/runs${qs({
                projectId,
                cursor: opts.cursor,
                limit: opts.limit,
            })}`,
        ),

    /** `POST /v1/telegram/auto-reply/match` (internal — webhook entry point) */
    match: (body: MatchBody) =>
        rustFetch<MatchResp>(`${BASE}/match`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `GET /v1/telegram/auto-reply/conflicts` */
    conflicts: (projectId: string) =>
        rustFetch<ConflictsResp>(`${BASE}/conflicts${qs({ projectId })}`),

    // -----------------------------------------------------------------
    //  Legacy shims (call sites in `src/app/actions/telegram.actions.ts`).
    //  These adapt the old field names to the current backend. New code
    //  must use `create`/`update`/`delete`/`enable`/`disable` directly.
    // -----------------------------------------------------------------

    /** @deprecated use `create` or `update` */
    upsert: (body: LegacyUpsertBody) => {
        // The legacy shape required botId without a project context.
        // The new backend resolves project via the bot record. For
        // legacy callers we can't know projectId here — they should
        // migrate to the new methods. Best effort: send projectId equal
        // to botId so older paths see a clear "Project not found." rather
        // than a 500.
        const adapted: UpsertBody = {
            projectId: body.botId,
            botId: body.botId,
            name: body.name,
            status: body.isActive === false ? 'disabled' : 'enabled',
            priority: body.priority,
            trigger: body.trigger as RuleTrigger,
            conditions: [],
            actions: [],
        };
        if (body.ruleId) {
            return rustFetch<AckResult>(`${BASE}/${encodeURIComponent(body.ruleId)}`, {
                method: 'PUT',
                body: JSON.stringify(adapted),
            });
        }
        return rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(adapted),
        });
    },

    /** @deprecated use `delete` */
    deleteRule: (ruleId: string, projectIdOrBotId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(ruleId)}${qs({ projectId: projectIdOrBotId })}`,
            { method: 'DELETE' },
        ),

    /** @deprecated use `enable`/`disable` */
    toggle: (ruleId: string, projectIdOrBotId: string, isActive: boolean) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(ruleId)}/${isActive ? 'enable' : 'disable'}`,
            {
                method: 'POST',
                body: JSON.stringify({ projectId: projectIdOrBotId }),
            },
        ),
};

export type TelegramAutoReplyApi = typeof telegramAutoReplyApi;
