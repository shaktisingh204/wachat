'use server';

export async function executeTeamsWebhookAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const webhookUrl = String(inputs.webhookUrl ?? '').trim();
        const accessToken = String(inputs.accessToken ?? '').trim();
        const graphBase = 'https://graph.microsoft.com/v1.0';

        const webhookFetch = async (body: any) => {
            if (!webhookUrl) throw new Error('webhookUrl is required.');
            logger?.log('[TeamsWebhook] POST webhook');
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Teams webhook error: ${res.status} ${text}`);
            return { success: true, response: text };
        };

        const graphFetch = async (method: string, path: string, body?: any) => {
            if (!accessToken) throw new Error('accessToken is required for this action.');
            logger?.log(`[TeamsWebhook] Graph ${method} ${path}`);
            const res = await fetch(`${graphBase}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            });
            if (res.status === 204) return { success: true };
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.error?.message || data?.message || `Graph API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'sendWebhookMessage': {
                if (!inputs.text) throw new Error('text is required.');
                const data = await webhookFetch({ text: inputs.text });
                return { output: data };
            }

            case 'sendAdaptiveCard': {
                if (!inputs.card) throw new Error('card (Adaptive Card JSON) is required.');
                const card = typeof inputs.card === 'string' ? JSON.parse(inputs.card) : inputs.card;
                const payload = {
                    type: 'message',
                    attachments: [
                        {
                            contentType: 'application/vnd.microsoft.card.adaptive',
                            contentUrl: null,
                            content: card,
                        },
                    ],
                };
                const data = await webhookFetch(payload);
                return { output: data };
            }

            case 'sendHeroCard': {
                if (!inputs.title) throw new Error('title is required.');
                const payload = {
                    '@type': 'MessageCard',
                    '@context': 'http://schema.org/extensions',
                    themeColor: inputs.themeColor ?? '0076D7',
                    summary: inputs.title,
                    sections: [
                        {
                            activityTitle: inputs.title,
                            activitySubtitle: inputs.subtitle ?? '',
                            activityText: inputs.text ?? '',
                            activityImage: inputs.imageUrl ?? '',
                        },
                    ],
                };
                const data = await webhookFetch(payload);
                return { output: data };
            }

            case 'sendThumbnailCard': {
                if (!inputs.title) throw new Error('title is required.');
                const payload = {
                    '@type': 'MessageCard',
                    '@context': 'http://schema.org/extensions',
                    themeColor: inputs.themeColor ?? '0076D7',
                    summary: inputs.title,
                    sections: [
                        {
                            activityTitle: inputs.title,
                            activitySubtitle: inputs.subtitle ?? '',
                            activityText: inputs.text ?? '',
                            activityImage: inputs.thumbnailUrl ?? '',
                        },
                    ],
                    potentialAction: inputs.actions ?? [],
                };
                const data = await webhookFetch(payload);
                return { output: data };
            }

            case 'sendMessageToChannel': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                if (!channelId) throw new Error('channelId is required.');
                if (!inputs.content) throw new Error('content is required.');
                const body = {
                    body: { contentType: inputs.contentType ?? 'text', content: inputs.content },
                };
                const data = await graphFetch('POST', `/teams/${teamId}/channels/${channelId}/messages`, body);
                return { output: data };
            }

            case 'sendMessageToChat': {
                const chatId = String(inputs.chatId ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!inputs.content) throw new Error('content is required.');
                const body = {
                    body: { contentType: inputs.contentType ?? 'text', content: inputs.content },
                };
                const data = await graphFetch('POST', `/chats/${chatId}/messages`, body);
                return { output: data };
            }

            case 'replyToMessage': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                if (!teamId || !channelId || !messageId) throw new Error('teamId, channelId, and messageId are required.');
                if (!inputs.content) throw new Error('content is required.');
                const body = {
                    body: { contentType: inputs.contentType ?? 'text', content: inputs.content },
                };
                const data = await graphFetch('POST', `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`, body);
                return { output: data };
            }

            case 'updateMessage': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                if (!teamId || !channelId || !messageId) throw new Error('teamId, channelId, and messageId are required.');
                if (!inputs.content) throw new Error('content is required.');
                const body = {
                    body: { contentType: inputs.contentType ?? 'text', content: inputs.content },
                };
                const data = await graphFetch('PATCH', `/teams/${teamId}/channels/${channelId}/messages/${messageId}`, body);
                return { output: data };
            }

            case 'deleteMessage': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                if (!teamId || !channelId || !messageId) throw new Error('teamId, channelId, and messageId are required.');
                const data = await graphFetch('DELETE', `/teams/${teamId}/channels/${channelId}/messages/${messageId}`);
                return { output: data };
            }

            case 'sendMention': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                if (!teamId || !channelId) throw new Error('teamId and channelId are required.');
                if (!inputs.userId) throw new Error('userId is required.');
                if (!inputs.displayName) throw new Error('displayName is required.');
                const mentionContent = `<at id="0">${inputs.displayName}</at> ${inputs.message ?? ''}`;
                const body = {
                    body: { contentType: 'html', content: mentionContent },
                    mentions: [
                        {
                            id: 0,
                            mentionText: inputs.displayName,
                            mentioned: { user: { id: inputs.userId, displayName: inputs.displayName } },
                        },
                    ],
                };
                const data = await graphFetch('POST', `/teams/${teamId}/channels/${channelId}/messages`, body);
                return { output: data };
            }

            case 'createTeam': {
                if (!inputs.displayName) throw new Error('displayName is required.');
                const body: any = {
                    'template@odata.bind': `https://graph.microsoft.com/v1.0/teamsTemplates('standard')`,
                    displayName: inputs.displayName,
                    description: inputs.description ?? '',
                };
                if (inputs.visibility) body.visibility = inputs.visibility;
                const data = await graphFetch('POST', '/teams', body);
                return { output: data };
            }

            case 'addMemberToTeam': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                if (!inputs.userId) throw new Error('userId is required.');
                const body = {
                    '@odata.type': '#microsoft.graph.aadUserConversationMember',
                    roles: inputs.roles ?? [],
                    'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${inputs.userId}')`,
                };
                const data = await graphFetch('POST', `/teams/${teamId}/members`, body);
                return { output: data };
            }

            case 'listTeamChannels': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await graphFetch('GET', `/teams/${teamId}/channels`);
                return { output: data };
            }

            case 'createChannel': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                if (!inputs.displayName) throw new Error('displayName is required.');
                const body: any = {
                    displayName: inputs.displayName,
                    membershipType: inputs.membershipType ?? 'standard',
                };
                if (inputs.description) body.description = inputs.description;
                const data = await graphFetch('POST', `/teams/${teamId}/channels`, body);
                return { output: data };
            }

            case 'sendNotification': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                if (!inputs.topic || !inputs.text) throw new Error('topic and text are required.');
                const body = {
                    topic: { source: 'entityUrl', value: `https://graph.microsoft.com/v1.0/teams/${teamId}` },
                    activityType: inputs.activityType ?? 'taskCreated',
                    previewText: { content: inputs.text },
                    templateParameters: inputs.templateParameters ?? [],
                };
                const data = await graphFetch('POST', `/teams/${teamId}/sendActivityNotification`, body);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Teams Webhook action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[TeamsWebhook] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
