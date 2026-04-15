'use server';

export async function executeGoogleChatAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const baseUrl = 'https://chat.googleapis.com/v1';

        const chatFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[GoogleChat] ${method} ${path}`);
            const res = await fetch(`${baseUrl}${path}`, {
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
            if (!res.ok) throw new Error(data?.error?.message || data?.message || `Google Chat API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'sendMessage': {
                const spaceName = String(inputs.spaceName ?? '').trim();
                if (!spaceName) throw new Error('spaceName is required.');
                const body: any = { text: inputs.text };
                if (inputs.cardsV2) body.cardsV2 = inputs.cardsV2;
                const data = await chatFetch('POST', `/${spaceName}/messages`, body);
                return { output: data };
            }

            case 'sendWebhookMessage': {
                const webhookUrl = String(inputs.webhookUrl ?? '').trim();
                if (!webhookUrl) throw new Error('webhookUrl is required.');
                const body: any = { text: inputs.text };
                if (inputs.cardsV2) body.cardsV2 = inputs.cardsV2;
                logger?.log('[GoogleChat] POST webhook');
                const res = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                if (!res.ok) throw new Error(`Webhook error: ${res.status}`);
                return { output: data };
            }

            case 'createSpace': {
                const body: any = {
                    displayName: inputs.displayName,
                    spaceType: inputs.spaceType ?? 'SPACE',
                };
                if (inputs.externalUserAllowed !== undefined) body.externalUserAllowed = inputs.externalUserAllowed;
                const data = await chatFetch('POST', '/spaces', body);
                return { output: data };
            }

            case 'getSpace': {
                const spaceName = String(inputs.spaceName ?? '').trim();
                if (!spaceName) throw new Error('spaceName is required.');
                const data = await chatFetch('GET', `/${spaceName}`);
                return { output: data };
            }

            case 'listSpaces': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', String(inputs.pageToken));
                if (inputs.filter) params.set('filter', String(inputs.filter));
                const query = params.toString() ? `?${params}` : '';
                const data = await chatFetch('GET', `/spaces${query}`);
                return { output: data };
            }

            case 'deleteSpace': {
                const spaceName = String(inputs.spaceName ?? '').trim();
                if (!spaceName) throw new Error('spaceName is required.');
                const data = await chatFetch('DELETE', `/${spaceName}`);
                return { output: data };
            }

            case 'listMembers': {
                const spaceName = String(inputs.spaceName ?? '').trim();
                if (!spaceName) throw new Error('spaceName is required.');
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', String(inputs.pageToken));
                const query = params.toString() ? `?${params}` : '';
                const data = await chatFetch('GET', `/${spaceName}/members${query}`);
                return { output: data };
            }

            case 'createMembership': {
                const spaceName = String(inputs.spaceName ?? '').trim();
                if (!spaceName) throw new Error('spaceName is required.');
                const body: any = { member: inputs.member };
                if (inputs.role) body.role = inputs.role;
                const data = await chatFetch('POST', `/${spaceName}/members`, body);
                return { output: data };
            }

            case 'deleteMembership': {
                const membershipName = String(inputs.membershipName ?? '').trim();
                if (!membershipName) throw new Error('membershipName is required.');
                const data = await chatFetch('DELETE', `/${membershipName}`);
                return { output: data };
            }

            case 'updateMessage': {
                const messageName = String(inputs.messageName ?? '').trim();
                if (!messageName) throw new Error('messageName is required.');
                const updateMask = inputs.updateMask ?? 'text';
                const body: any = { text: inputs.text };
                if (inputs.cardsV2) body.cardsV2 = inputs.cardsV2;
                const data = await chatFetch('PATCH', `/${messageName}?updateMask=${updateMask}`, body);
                return { output: data };
            }

            case 'deleteMessage': {
                const messageName = String(inputs.messageName ?? '').trim();
                if (!messageName) throw new Error('messageName is required.');
                const data = await chatFetch('DELETE', `/${messageName}`);
                return { output: data };
            }

            case 'listMessages': {
                const spaceName = String(inputs.spaceName ?? '').trim();
                if (!spaceName) throw new Error('spaceName is required.');
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', String(inputs.pageToken));
                if (inputs.filter) params.set('filter', String(inputs.filter));
                if (inputs.orderBy) params.set('orderBy', String(inputs.orderBy));
                const query = params.toString() ? `?${params}` : '';
                const data = await chatFetch('GET', `/${spaceName}/messages${query}`);
                return { output: data };
            }

            case 'createReaction': {
                const messageName = String(inputs.messageName ?? '').trim();
                if (!messageName) throw new Error('messageName is required.');
                if (!inputs.emoji) throw new Error('emoji is required.');
                const body = { emoji: inputs.emoji };
                const data = await chatFetch('POST', `/${messageName}/reactions`, body);
                return { output: data };
            }

            case 'deleteReaction': {
                const reactionName = String(inputs.reactionName ?? '').trim();
                if (!reactionName) throw new Error('reactionName is required.');
                const data = await chatFetch('DELETE', `/${reactionName}`);
                return { output: data };
            }

            case 'updateSpace': {
                const spaceName = String(inputs.spaceName ?? '').trim();
                if (!spaceName) throw new Error('spaceName is required.');
                const updateMask = inputs.updateMask ?? 'displayName';
                const body: any = {};
                if (inputs.displayName) body.displayName = inputs.displayName;
                if (inputs.spaceDetails) body.spaceDetails = inputs.spaceDetails;
                const data = await chatFetch('PATCH', `/${spaceName}?updateMask=${updateMask}`, body);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Google Chat action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[GoogleChat] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
