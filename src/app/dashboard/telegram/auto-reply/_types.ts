/**
 * Mirror of the shapes exposed by `@/lib/rust-client/telegram-auto-reply`.
 *
 * The rust-client module is `server-only` so we can't import it from the
 * page's client component. Keeping a thin parallel set of types here lets
 * the client work against typed payloads while server actions adapt them
 * onto the underlying rust client.
 */

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
    payload?: any;
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

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    ruleId?: string;
}

export interface ListResp {
    rules: RuleRow[];
    total: number;
    page: number;
    pageSize: number;
    error?: string;
}

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
