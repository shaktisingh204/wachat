
'use server';

import type { WithId, User } from '@/lib/definitions';
import axios from 'axios';

const SLACK_BASE = 'https://slack.com/api';

function getSlackToken(user: WithId<User>): string {
    const settings = (user as any).sabFlowConnections?.find((c: any) => c.appName === 'Slack');
    if (!settings?.credentials) throw new Error('Slack is not connected.');
    const token = settings.credentials.accessToken || settings.credentials.apiKey || settings.credentials.botToken;
    if (!token) throw new Error('Slack connection is missing an access token.');
    return String(token);
}

async function slackApi(method: string, token: string, body: any) {
    const res = await axios.post(`${SLACK_BASE}/${method}`, body, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
        },
    });
    if (!res.data.ok) {
        throw new Error(`Slack API error: ${res.data.error || 'unknown'}`);
    }
    return res.data;
}

export async function executeSlackAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        const token = getSlackToken(user);

        switch (actionName) {
            case 'sendMessage': {
                const channel = String(inputs.channel ?? '').trim();
                const text = String(inputs.text ?? '');
                if (!channel) throw new Error('channel is required.');
                if (!text) throw new Error('text is required.');
                const data = await slackApi('chat.postMessage', token, { channel, text });
                logger.log(`[Slack] Posted to ${channel}`);
                return { output: { ts: data.ts, channel: data.channel } };
            }

            case 'sendDirectMessage': {
                const userId = String(inputs.userId ?? '').trim();
                const text = String(inputs.text ?? '');
                if (!userId) throw new Error('userId is required.');
                if (!text) throw new Error('text is required.');
                // Open a DM channel first
                const openRes = await slackApi('conversations.open', token, { users: userId });
                const dmChannel = openRes.channel?.id;
                if (!dmChannel) throw new Error('Failed to open DM channel.');
                const sendRes = await slackApi('chat.postMessage', token, { channel: dmChannel, text });
                return { output: { ts: sendRes.ts, channel: dmChannel } };
            }

            case 'updateMessage': {
                const channel = String(inputs.channel ?? '').trim();
                const ts = String(inputs.ts ?? '').trim();
                const text = String(inputs.text ?? '');
                if (!channel || !ts) throw new Error('channel and ts are required.');
                const data = await slackApi('chat.update', token, { channel, ts, text });
                return { output: { ok: String(Boolean(data.ok)) } };
            }

            case 'addReaction': {
                const channel = String(inputs.channel ?? '').trim();
                const ts = String(inputs.ts ?? '').trim();
                const emoji = String(inputs.emoji ?? '').trim().replace(/^:|:$/g, '');
                if (!channel || !ts || !emoji) throw new Error('channel, ts and emoji are required.');
                const data = await slackApi('reactions.add', token, { channel, timestamp: ts, name: emoji });
                return { output: { ok: String(Boolean(data.ok)) } };
            }

            case 'listChannels': {
                const res = await axios.get(`${SLACK_BASE}/conversations.list`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { types: 'public_channel', limit: 200 },
                });
                if (!res.data.ok) throw new Error(`Slack API error: ${res.data.error}`);
                const channels = res.data.channels || [];
                return { output: { channels, count: channels.length } };
            }

            default:
                return { error: `Slack action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e?.response?.data?.error || e.message || 'Slack action failed.' };
    }
}
