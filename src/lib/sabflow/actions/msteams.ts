'use server';

export async function executeMsTeamsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = inputs.accessToken;
        const baseUrl = 'https://graph.microsoft.com/v1.0';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listTeams': {
                const res = await fetch(`${baseUrl}/me/joinedTeams`, { headers });
                if (!res.ok) return { error: `listTeams failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getTeam': {
                const teamId = inputs.teamId;
                const res = await fetch(`${baseUrl}/teams/${teamId}`, { headers });
                if (!res.ok) return { error: `getTeam failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createTeam': {
                const body = {
                    'template@odata.bind': inputs.template || "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
                    displayName: inputs.displayName,
                    description: inputs.description,
                };
                const res = await fetch(`${baseUrl}/teams`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createTeam failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, location: res.headers.get('Location') } };
            }
            case 'listChannels': {
                const teamId = inputs.teamId;
                const res = await fetch(`${baseUrl}/teams/${teamId}/channels`, { headers });
                if (!res.ok) return { error: `listChannels failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getChannel': {
                const teamId = inputs.teamId;
                const channelId = inputs.channelId;
                const res = await fetch(`${baseUrl}/teams/${teamId}/channels/${channelId}`, { headers });
                if (!res.ok) return { error: `getChannel failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createChannel': {
                const teamId = inputs.teamId;
                const body = {
                    displayName: inputs.displayName,
                    description: inputs.description,
                    membershipType: inputs.membershipType || 'standard',
                };
                const res = await fetch(`${baseUrl}/teams/${teamId}/channels`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createChannel failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'sendChannelMessage': {
                const teamId = inputs.teamId;
                const channelId = inputs.channelId;
                const res = await fetch(`${baseUrl}/teams/${teamId}/channels/${channelId}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ body: { contentType: 'html', content: inputs.message } }),
                });
                if (!res.ok) return { error: `sendChannelMessage failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'sendChatMessage': {
                const chatId = inputs.chatId;
                const res = await fetch(`${baseUrl}/chats/${chatId}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ body: { content: inputs.content } }),
                });
                if (!res.ok) return { error: `sendChatMessage failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listChatMessages': {
                const teamId = inputs.teamId;
                const channelId = inputs.channelId;
                const res = await fetch(`${baseUrl}/teams/${teamId}/channels/${channelId}/messages`, { headers });
                if (!res.ok) return { error: `listChatMessages failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'replyToMessage': {
                const teamId = inputs.teamId;
                const channelId = inputs.channelId;
                const messageId = inputs.messageId;
                const res = await fetch(`${baseUrl}/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ body: { content: inputs.content } }),
                });
                if (!res.ok) return { error: `replyToMessage failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listMembers': {
                const teamId = inputs.teamId;
                const res = await fetch(`${baseUrl}/teams/${teamId}/members`, { headers });
                if (!res.ok) return { error: `listMembers failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'addMember': {
                const teamId = inputs.teamId;
                const body = {
                    '@odata.type': '#microsoft.graph.aadUserConversationMember',
                    roles: inputs.roles || [],
                    'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${inputs.userId}')`,
                };
                const res = await fetch(`${baseUrl}/teams/${teamId}/members`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `addMember failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createMeeting': {
                const res = await fetch(`${baseUrl}/me/onlineMeetings`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        subject: inputs.subject,
                        startDateTime: inputs.startDateTime,
                        endDateTime: inputs.endDateTime,
                    }),
                });
                if (!res.ok) return { error: `createMeeting failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listMeetings': {
                const res = await fetch(`${baseUrl}/me/onlineMeetings`, { headers });
                if (!res.ok) return { error: `listMeetings failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getMeeting': {
                const meetingId = inputs.meetingId;
                const res = await fetch(`${baseUrl}/me/onlineMeetings/${meetingId}`, { headers });
                if (!res.ok) return { error: `getMeeting failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Unknown MS Teams action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeMsTeamsAction error: ${err.message}`);
        return { error: err.message || 'MS Teams action failed' };
    }
}
