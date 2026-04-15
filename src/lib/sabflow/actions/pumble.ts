'use server';

export async function executePumbleAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const baseUrl = 'https://api.pumble.com/v1';

        switch (actionName) {
            case 'sendMessage': {
                const res = await fetch(`${baseUrl}/chat.postMessage`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: inputs.channel,
                        text: inputs.text,
                        blocks: inputs.blocks,
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { message: data.message, ts: data.ts } };
            }

            case 'listChannels': {
                const params = new URLSearchParams({ limit: String(inputs.limit || 100) });
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/conversations.list?${params}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channels: data.channels || [], nextCursor: data.response_metadata?.next_cursor } };
            }

            case 'getChannel': {
                const res = await fetch(`${baseUrl}/conversations.info?channel=${inputs.channel}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channel: data.channel } };
            }

            case 'createChannel': {
                const res = await fetch(`${baseUrl}/conversations.create`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: inputs.name,
                        is_private: inputs.isPrivate || false,
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channel: data.channel } };
            }

            case 'archiveChannel': {
                const res = await fetch(`${baseUrl}/conversations.archive`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: inputs.channel }),
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { result: 'archived' } };
            }

            case 'inviteMembers': {
                const res = await fetch(`${baseUrl}/conversations.invite`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: inputs.channel,
                        users: Array.isArray(inputs.users) ? inputs.users.join(',') : inputs.users,
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channel: data.channel } };
            }

            case 'listMembers': {
                const params = new URLSearchParams({ channel: inputs.channel, limit: String(inputs.limit || 100) });
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/conversations.members?${params}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { members: data.members || [], nextCursor: data.response_metadata?.next_cursor } };
            }

            case 'getWorkspace': {
                const res = await fetch(`${baseUrl}/team.info`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { workspace: data.team } };
            }

            case 'uploadFile': {
                const res = await fetch(`${baseUrl}/files.upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channels: inputs.channels,
                        filename: inputs.filename,
                        content: inputs.content,
                        filetype: inputs.filetype,
                        title: inputs.title,
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { file: data.file } };
            }

            case 'listDirectMessages': {
                const params = new URLSearchParams({ limit: String(inputs.limit || 100) });
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/im.list?${params}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channels: data.ims || [], nextCursor: data.response_metadata?.next_cursor } };
            }

            case 'sendDirectMessage': {
                const openRes = await fetch(`${baseUrl}/im.open`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user: inputs.user }),
                });
                const openData = await openRes.json();
                if (!openRes.ok || !openData.ok) throw new Error(openData?.error || `API error: ${openRes.status}`);
                const channelId = openData.channel?.id;
                const res = await fetch(`${baseUrl}/chat.postMessage`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: channelId, text: inputs.text }),
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { message: data.message, ts: data.ts } };
            }

            case 'listMentions': {
                const params = new URLSearchParams({ channel: inputs.channel, limit: String(inputs.limit || 50) });
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/conversations.history?${params}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                const mentions = (data.messages || []).filter((m: any) => m.text && m.text.includes(`<@${inputs.userId || ''}>`));
                return { output: { mentions } };
            }

            case 'markAsRead': {
                const res = await fetch(`${baseUrl}/conversations.mark`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: inputs.channel, ts: inputs.ts }),
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { result: 'marked' } };
            }

            case 'searchMessages': {
                const params = new URLSearchParams({ query: inputs.query, count: String(inputs.count || 20) });
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/search.messages?${params}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { messages: data.messages?.matches || [], total: data.messages?.total } };
            }

            case 'getProfile': {
                const params = new URLSearchParams();
                if (inputs.userId) params.set('user', inputs.userId);
                const res = await fetch(`${baseUrl}/users.profile.get?${params}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { profile: data.profile } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
