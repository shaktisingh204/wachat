/**
 * Pure helpers shared by the auto-reply page components — text formatters,
 * trigger/condition/action defaults, validation.
 */

import type {
    ActionKind,
    ConditionKind,
    RuleAction,
    RuleCondition,
    RuleTrigger,
    TriggerKind,
} from '../_types';

export const TRIGGER_KINDS: { value: TriggerKind; label: string }[] = [
    { value: 'keyword', label: 'Keyword (any of)' },
    { value: 'contains_any', label: 'Contains any of' },
    { value: 'exact', label: 'Exact match' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'regex', label: 'Regular expression' },
    { value: 'business_hours', label: 'During business hours' },
    { value: 'first_message', label: 'First message from contact' },
    { value: 'media_only', label: 'Media-only message' },
];

export const CONDITION_KINDS: { value: ConditionKind; label: string }[] = [
    { value: 'has_media', label: 'Message has media' },
    { value: 'is_group', label: 'Chat is a group' },
    { value: 'is_private', label: 'Chat is private (DM)' },
    { value: 'contact_has_tag', label: 'Contact has tag' },
    { value: 'time_window', label: 'Within time window' },
    { value: 'sender_role', label: 'Sender role equals' },
];

export const ACTION_KINDS: { value: ActionKind; label: string }[] = [
    { value: 'reply_text', label: 'Reply with text' },
    { value: 'reply_media', label: 'Reply with media' },
    { value: 'forward_to_chat', label: 'Forward to chat' },
    { value: 'tag_contact', label: 'Tag contact' },
    { value: 'remove_tag', label: 'Remove tag' },
    { value: 'assign_agent', label: 'Assign agent' },
    { value: 'run_flow', label: 'Run flow' },
    { value: 'set_variable', label: 'Set variable' },
    { value: 'http_call', label: 'HTTP call' },
    { value: 'do_nothing', label: 'Do nothing' },
];

export function triggerSummary(trigger: RuleTrigger | undefined | null): string {
    if (!trigger) return '—';
    const kind = trigger.kind;
    const payload = trigger.payload as unknown;
    switch (kind) {
        case 'keyword':
        case 'contains_any': {
            const list = Array.isArray(payload)
                ? (payload as string[])
                : typeof payload === 'string'
                  ? payload.split(',').map((p) => p.trim()).filter(Boolean)
                  : [];
            const head = list.slice(0, 3).join(', ');
            return list.length > 3
                ? `${kind === 'keyword' ? 'Keyword' : 'Contains any'}: ${head} +${list.length - 3}`
                : `${kind === 'keyword' ? 'Keyword' : 'Contains any'}: ${head || '(empty)'}`;
        }
        case 'exact':
            return `Exact: "${typeof payload === 'string' ? payload : ''}"`;
        case 'starts_with':
            return `Starts with: "${typeof payload === 'string' ? payload : ''}"`;
        case 'regex':
            return `Regex /${typeof payload === 'string' ? payload : ''}/`;
        case 'business_hours':
            return 'During business hours';
        case 'first_message':
            return 'First message from contact';
        case 'media_only':
            return 'Media-only message';
        default:
            return String(kind);
    }
}

export function actionLabel(kind: ActionKind): string {
    return ACTION_KINDS.find((a) => a.value === kind)?.label ?? kind;
}

export function conditionLabel(kind: ConditionKind): string {
    return CONDITION_KINDS.find((c) => c.value === kind)?.label ?? kind;
}

export function defaultTrigger(): RuleTrigger {
    return { kind: 'keyword', payload: [], caseSensitive: false };
}

export function defaultCondition(kind: ConditionKind = 'has_media'): RuleCondition {
    if (kind === 'contact_has_tag' || kind === 'sender_role') {
        return { kind, payload: '' };
    }
    if (kind === 'time_window') {
        return { kind, payload: { startHour: 9, endHour: 18 } };
    }
    return { kind, payload: null };
}

export function defaultAction(kind: ActionKind = 'reply_text'): RuleAction {
    switch (kind) {
        case 'reply_text':
            return { kind, payload: { text: '', parseMode: 'plain' } };
        case 'reply_media':
            return { kind, payload: { fileId: '', url: '', caption: '' } };
        case 'forward_to_chat':
            return { kind, payload: { chatId: '' } };
        case 'tag_contact':
        case 'remove_tag':
            return { kind, payload: { tag: '' } };
        case 'assign_agent':
            return { kind, payload: { agentUserId: '' } };
        case 'run_flow':
            return { kind, payload: { flowId: '' } };
        case 'set_variable':
            return { kind, payload: { key: '', value: '' } };
        case 'http_call':
            return {
                kind,
                payload: {
                    method: 'POST',
                    url: '',
                    headers: '',
                    body: '',
                },
            };
        case 'do_nothing':
        default:
            return { kind: 'do_nothing', payload: null };
    }
}
