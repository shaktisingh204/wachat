'use server';

export async function executeFlockAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        const baseUrl = 'https://api.flock.com/v2';

        switch (actionName) {
            case 'sendMessage': {
                const params = new URLSearchParams({
                    token,
                    channel: inputs.channel,
                    text: inputs.text,
                });
                if (inputs.title) params.set('title', inputs.title);
                const res = await fetch(`${baseUrl}/chat.sendMessage?${params}`);
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { uid: data.uid } };
            }

            case 'sendDirectMessage': {
                const params = new URLSearchParams({
                    token,
                    to: inputs.to,
                    text: inputs.text,
                });
                if (inputs.title) params.set('title', inputs.title);
                const res = await fetch(`${baseUrl}/chat.sendMessage?${params}`);
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { uid: data.uid } };
            }

            case 'createChannel': {
                const res = await fetch(`${baseUrl}/channels.create?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        member_ids: inputs.memberIds || [],
                    }),
                });
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channel: data.channel } };
            }

            case 'listChannels': {
                const params = new URLSearchParams({ token });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/channels.list?${params}`);
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channels: data.channels || [] } };
            }

            case 'getChannelInfo': {
                const res = await fetch(`${baseUrl}/channels.info?token=${token}&channel=${inputs.channel}`);
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channel: data.channel } };
            }

            case 'inviteMembers': {
                const res = await fetch(`${baseUrl}/channels.inviteMembers?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: inputs.channel,
                        member_ids: inputs.memberIds || [],
                    }),
                });
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'kickMember': {
                const res = await fetch(`${baseUrl}/channels.kickMember?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: inputs.channel, member_id: inputs.memberId }),
                });
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'uploadFile': {
                const res = await fetch(`${baseUrl}/files.upload?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: inputs.channel,
                        filename: inputs.filename,
                        content: inputs.content,
                        filetype: inputs.filetype || 'text',
                    }),
                });
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { file: data.file } };
            }

            case 'sendAttachment': {
                const res = await fetch(`${baseUrl}/chat.sendMessage?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: inputs.channel,
                        text: inputs.text || '',
                        attachments: inputs.attachments || [],
                    }),
                });
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { uid: data.uid } };
            }

            case 'setChannelTopic': {
                const res = await fetch(`${baseUrl}/channels.setTopic?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: inputs.channel, topic: inputs.topic }),
                });
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'archiveChannel': {
                const res = await fetch(`${baseUrl}/channels.archive?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: inputs.channel }),
                });
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { result: data } };
            }

            case 'listGroupMembers': {
                const res = await fetch(`${baseUrl}/groups.members?token=${token}&group=${inputs.group}`);
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { members: data.members || [] } };
            }

            case 'getProfile': {
                const res = await fetch(`${baseUrl}/users.info?token=${token}&user_id=${inputs.userId || ''}`);
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { profile: data.user } };
            }

            case 'searchMessages': {
                const params = new URLSearchParams({ token, query: inputs.query });
                if (inputs.channel) params.set('channel', inputs.channel);
                if (inputs.count) params.set('count', String(inputs.count));
                const res = await fetch(`${baseUrl}/chat.search?${params}`);
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { messages: data.messages || [] } };
            }

            case 'sendRichMessage': {
                const res = await fetch(`${baseUrl}/chat.sendMessage?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: inputs.channel,
                        text: inputs.text || '',
                        title: inputs.title,
                        description: inputs.description,
                        color: inputs.color,
                        buttons: inputs.buttons || [],
                        views: inputs.views || [],
                    }),
                });
                const data = await res.json();
                if (data.result !== 'ok') throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { uid: data.uid } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
