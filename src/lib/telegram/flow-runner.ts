import 'server-only';

import type { Db, WithId } from 'mongodb';

import type { TelegramBot } from '@/lib/definitions';
import { TelegramBotApi } from './bot-api';

/**
 * Execute Telegram-flows for an inbound update.
 *
 * Scope (MVP): finds published+enabled flows for the bot's project whose
 * trigger matches the inbound message, then walks the graph starting at
 * the "trigger" entry and runs the first reachable action node. Multi-step
 * interactive flows (wait_for_reply, branch_*) are deferred — the runner
 * stops at those node types and records a continuation cursor in
 * `telegram_flow_runs` so a future executor can resume.
 *
 * Triggers handled:
 *   - command            — fires when message.text starts with /{command}
 *   - incoming_message   — fires on any inbound text/caption, optionally
 *                          filtered by exact / contains / regex
 *
 * Returns `true` when a flow was matched (and at least one node ran), so
 * the caller can suppress auto-reply fallbacks if desired.
 */

type FlowDoc = {
    _id: any;
    projectId: any;
    name: string;
    status: 'draft' | 'published' | 'disabled' | string;
    trigger: {
        kind: string;
        command?: string;
        dataPrefix?: string;
        filter?: { type?: string; value?: string };
    };
    nodes: Array<{
        id: string;
        type: string;
        data?: Record<string, any>;
    }>;
    edges: Array<{
        id: string;
        source: string;
        target: string;
        sourceHandle?: string;
    }>;
};

const TRIGGER_NODE_IDS = new Set(['trigger', '__trigger__']);

function extractText(message: any): string {
    if (typeof message?.text === 'string') return message.text;
    if (typeof message?.caption === 'string') return message.caption;
    return '';
}

function matchFilter(
    filter: FlowDoc['trigger']['filter'],
    text: string,
): boolean {
    if (!filter || !filter.type) return true;
    const value = filter.value ?? '';
    switch (filter.type) {
        case 'exact':
            return text === value;
        case 'contains':
            return value !== '' && text.includes(value);
        case 'regex':
            try {
                return new RegExp(value).test(text);
            } catch {
                return false;
            }
        case 'hasMedia':
            // The caller passes text from text/caption; if both are empty
            // the message likely has media.
            return text === '';
        default:
            return true;
    }
}

function commandFromText(text: string): string | null {
    const t = text.trim();
    if (!t.startsWith('/')) return null;
    const head = t.split(/\s+/)[0]!.slice(1);
    // Strip @botname suffix some clients add: `/start@MyBot`
    return head.split('@')[0]!.toLowerCase();
}

function pickEntryNode(flow: FlowDoc): FlowDoc['nodes'][number] | null {
    // Find edges from the trigger pseudo-node — those targets are the entry.
    for (const e of flow.edges) {
        if (TRIGGER_NODE_IDS.has(e.source)) {
            const target = flow.nodes.find((n) => n.id === e.target);
            if (target) return target;
        }
    }
    // Fall back to the first non-trigger node.
    return flow.nodes.find((n) => !TRIGGER_NODE_IDS.has(n.id)) ?? null;
}

function nextNode(
    flow: FlowDoc,
    currentId: string,
): FlowDoc['nodes'][number] | null {
    for (const e of flow.edges) {
        if (e.source === currentId) {
            const t = flow.nodes.find((n) => n.id === e.target);
            if (t) return t;
        }
    }
    return null;
}

async function runNode(
    bot: WithId<TelegramBot>,
    chatId: string,
    node: FlowDoc['nodes'][number],
): Promise<{ ok: boolean; stopAt?: string; error?: string }> {
    const data = node.data ?? {};
    try {
        switch (node.type) {
            case 'send_message': {
                const text = String(data.text ?? '').trim();
                if (!text) return { ok: true };
                await TelegramBotApi.sendMessage(bot.token, {
                    chat_id: chatId,
                    text,
                    parse_mode: data.parseMode,
                });
                return { ok: true };
            }
            case 'send_media': {
                const url = String(data.url ?? '');
                const caption = data.caption ? String(data.caption) : undefined;
                const kind = String(data.mediaKind ?? 'photo');
                if (!url) return { ok: true };
                if (kind === 'video') {
                    await TelegramBotApi.sendVideo(bot.token, {
                        chat_id: chatId,
                        video: url,
                        caption,
                    });
                } else if (kind === 'document') {
                    await TelegramBotApi.sendDocument(bot.token, {
                        chat_id: chatId,
                        document: url,
                        caption,
                    });
                } else {
                    await TelegramBotApi.sendPhoto(bot.token, {
                        chat_id: chatId,
                        photo: url,
                        caption,
                    });
                }
                return { ok: true };
            }
            case 'wait_for_reply':
            case 'branch_by_text':
            case 'branch_by_callback':
                // Stateful nodes — leave for a future executor to resume.
                return { ok: true, stopAt: node.id };
            case 'end':
                return { ok: true, stopAt: node.id };
            default:
                // Unknown / unsupported node — record and stop without erroring.
                return { ok: true, stopAt: node.id };
        }
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export async function runTelegramFlowsForUpdate(
    db: Db,
    bot: WithId<TelegramBot>,
    chatId: string,
    message: any,
): Promise<boolean> {
    const text = extractText(message);
    const cmd = commandFromText(text);

    // Fetch published+enabled flows for this project. Status 'published'
    // is what `enable` sets; 'disabled' is the explicit off-state.
    const flows = await db
        .collection<FlowDoc>('telegram_flows')
        .find({ projectId: bot.projectId, status: 'published' })
        .toArray();
    if (flows.length === 0) return false;

    const matched: FlowDoc[] = [];
    for (const f of flows) {
        const t = f.trigger ?? { kind: '' };
        if (t.kind === 'command') {
            const want = (t.command ?? '').replace(/^\//, '').toLowerCase();
            if (cmd && want && cmd === want) matched.push(f);
        } else if (t.kind === 'incoming_message') {
            if (matchFilter(t.filter, text)) matched.push(f);
        }
        // schedule / business_connection / callback_query — handled by other paths.
    }
    if (matched.length === 0) return false;

    let executed = false;
    for (const flow of matched) {
        const entry = pickEntryNode(flow);
        if (!entry) continue;

        const trace: Array<{ nodeId: string; ok: boolean; error?: string }> = [];
        let cursor: FlowDoc['nodes'][number] | null = entry;
        let stopAt: string | undefined;
        // Safety cap — a malformed graph shouldn't burn the worker.
        for (let i = 0; cursor && i < 25; i++) {
            const res = await runNode(bot, chatId, cursor);
            trace.push({ nodeId: cursor.id, ok: res.ok, error: res.error });
            if (!res.ok) {
                stopAt = cursor.id;
                break;
            }
            if (res.stopAt) {
                stopAt = res.stopAt;
                break;
            }
            cursor = nextNode(flow, cursor.id);
        }

        const now = new Date();
        const ok = trace.every((t) => t.ok);
        executed = executed || ok;

        await db.collection('telegram_flow_runs').insertOne({
            flowId: flow._id,
            botId: bot._id,
            projectId: bot.projectId,
            chatId,
            trigger: flow.trigger?.kind,
            trace,
            stoppedAt: stopAt ?? null,
            success: ok,
            createdAt: now,
        });

        await db.collection('telegram_flows').updateOne(
            { _id: flow._id },
            {
                $inc: { runCount: 1, ...(ok ? {} : { errorCount: 1 }) },
                $set: { lastRunAt: now, updatedAt: now },
            },
        );
    }

    return executed;
}
