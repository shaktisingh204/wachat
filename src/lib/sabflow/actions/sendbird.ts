'use server';

export async function executeSendbirdAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = `https://api-${inputs.appId}.sendbird.com/v3`;
        const headers: Record<string, string> = {
            'Api-Token': inputs.apiToken,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'createUser': {
                const res = await fetch(`${baseUrl}/users`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        user_id: inputs.userId,
                        nickname: inputs.nickname,
                        profile_url: inputs.profileUrl || '',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create user' };
                return { output: data };
            }

            case 'getUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get user' };
                return { output: data };
            }

            case 'updateUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        nickname: inputs.nickname,
                        profile_url: inputs.profileUrl,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update user' };
                return { output: data };
            }

            case 'deleteUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { method: 'DELETE', headers });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.message || 'Failed to delete user' };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.token) params.set('token', inputs.token);
                const res = await fetch(`${baseUrl}/users?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list users' };
                return { output: data };
            }

            case 'listChannels': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.token) params.set('token', inputs.token);
                if (inputs.userId) params.set('members_include_in', inputs.userId);
                const res = await fetch(`${baseUrl}/group_channels?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list channels' };
                return { output: data };
            }

            case 'getChannel': {
                const res = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(inputs.channelUrl)}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get channel' };
                return { output: data };
            }

            case 'createChannel': {
                const res = await fetch(`${baseUrl}/group_channels`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        channel_url: inputs.channelUrl,
                        is_distinct: inputs.isDistinct ?? false,
                        user_ids: inputs.userIds || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create channel' };
                return { output: data };
            }

            case 'sendMessage': {
                const res = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(inputs.channelUrl)}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        message_type: 'MESG',
                        user_id: inputs.userId,
                        message: inputs.message,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send message' };
                return { output: data };
            }

            case 'getMessages': {
                const params = new URLSearchParams();
                if (inputs.messageTs) params.set('message_ts', String(inputs.messageTs));
                if (inputs.prevLimit) params.set('prev_limit', String(inputs.prevLimit));
                const res = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(inputs.channelUrl)}/messages?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get messages' };
                return { output: data };
            }

            case 'deleteMessage': {
                const res = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(inputs.channelUrl)}/messages/${inputs.messageId}`, { method: 'DELETE', headers });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.message || 'Failed to delete message' };
            }

            case 'updateMessage': {
                const res = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(inputs.channelUrl)}/messages/${inputs.messageId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        message_type: 'MESG',
                        message: inputs.message,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update message' };
                return { output: data };
            }

            case 'listMembers': {
                const res = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(inputs.channelUrl)}/members`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list members' };
                return { output: data };
            }

            case 'addMember': {
                const res = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(inputs.channelUrl)}/invite`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ user_ids: inputs.userIds || [] }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add member' };
                return { output: data };
            }

            case 'removeMember': {
                const res = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(inputs.channelUrl)}/members/${inputs.userId}`, { method: 'DELETE', headers });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.message || 'Failed to remove member' };
            }

            default:
                return { error: `Unknown Sendbird action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Sendbird action error: ${err.message}`);
        return { error: err.message || 'Sendbird action failed' };
    }
}
