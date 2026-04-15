'use server';

import { createHmac } from 'crypto';

function buildStreamJwt(apiKey: string, apiSecret: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ server: true, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
    const signature = createHmac('sha256', apiSecret)
        .update(`${header}.${payload}`)
        .digest('base64url');
    return `${header}.${payload}.${signature}`;
}

export async function executeStreamAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = `https://${inputs.apiKey}.stream-io-api.com/api/v1`;
        const token = buildStreamJwt(inputs.apiKey, inputs.apiSecret);
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'stream-auth-type': 'jwt',
            'Content-Type': 'application/json',
        };
        const qs = `api_key=${encodeURIComponent(inputs.apiKey)}`;

        switch (actionName) {
            case 'createUser': {
                const res = await fetch(`${baseUrl}/users?${qs}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        users: {
                            [inputs.id]: { id: inputs.id, name: inputs.name, role: inputs.role || 'user' },
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create user' };
                return { output: data };
            }

            case 'getUser': {
                const res = await fetch(`${baseUrl}/users?${qs}&id=${encodeURIComponent(inputs.id)}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get user' };
                return { output: data };
            }

            case 'updateUser': {
                const res = await fetch(`${baseUrl}/users?${qs}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        users: {
                            [inputs.id]: { id: inputs.id, name: inputs.name, role: inputs.role },
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update user' };
                return { output: data };
            }

            case 'deleteUser': {
                const res = await fetch(`${baseUrl}/users/${encodeURIComponent(inputs.id)}?${qs}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete user' };
                return { output: data };
            }

            case 'listChannels': {
                const res = await fetch(`${baseUrl}/channels?${qs}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ filter_conditions: inputs.filterConditions || {} }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list channels' };
                return { output: data };
            }

            case 'getChannel': {
                const res = await fetch(`${baseUrl}/channels/${inputs.type}/${inputs.id}/query?${qs}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get channel' };
                return { output: data };
            }

            case 'createChannel': {
                const res = await fetch(`${baseUrl}/channels/${inputs.type}/${inputs.id}?${qs}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        members: inputs.members || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create channel' };
                return { output: data };
            }

            case 'sendMessage': {
                const res = await fetch(`${baseUrl}/channels/${inputs.type}/${inputs.id}/message?${qs}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ message: { text: inputs.text, user_id: inputs.userId } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send message' };
                return { output: data };
            }

            case 'getMessages': {
                const res = await fetch(`${baseUrl}/channels/${inputs.type}/${inputs.id}/messages?${qs}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get messages' };
                return { output: data };
            }

            case 'deleteMessage': {
                const res = await fetch(`${baseUrl}/messages/${inputs.messageId}?${qs}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete message' };
                return { output: data };
            }

            case 'updateMessage': {
                const res = await fetch(`${baseUrl}/messages/${inputs.messageId}?${qs}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ message: { text: inputs.text } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update message' };
                return { output: data };
            }

            case 'addMembers': {
                const res = await fetch(`${baseUrl}/channels/${inputs.type}/${inputs.id}?${qs}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ add_members: inputs.memberIds || [] }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add members' };
                return { output: data };
            }

            case 'removeMembers': {
                const res = await fetch(`${baseUrl}/channels/${inputs.type}/${inputs.id}?${qs}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ remove_members: inputs.memberIds || [] }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to remove members' };
                return { output: data };
            }

            case 'banUser': {
                const res = await fetch(`${baseUrl}/moderation/ban?${qs}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ user_id: inputs.userId, timeout: inputs.timeout, reason: inputs.reason }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to ban user' };
                return { output: data };
            }

            case 'unbanUser': {
                const res = await fetch(`${baseUrl}/moderation/ban?${qs}&target_user_id=${encodeURIComponent(inputs.id)}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to unban user' };
                return { output: data };
            }

            default:
                return { error: `Unknown Stream Chat action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Stream Chat action error: ${err.message}`);
        return { error: err.message || 'Stream Chat action failed' };
    }
}
