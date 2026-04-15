'use server';

export async function executeTeamsEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const baseUrl = 'https://graph.microsoft.com/v1.0';
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        async function graphRequest(method: string, path: string, body?: any) {
            logger?.log(`[TeamsEnhanced] ${method} ${path}`);
            const opts: RequestInit = { method, headers };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(`${baseUrl}${path}`, opts);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error?.message || `Graph error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listTeams': {
                const top = Math.max(1, Math.min(100, Number(inputs.top ?? 20)));
                const data = await graphRequest('GET', `/me/joinedTeams?$top=${top}`);
                return { output: { teams: data.value ?? [] } };
            }

            case 'getTeam': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await graphRequest('GET', `/teams/${teamId}`);
                return { output: data };
            }

            case 'createTeam': {
                const displayName = String(inputs.displayName ?? '').trim();
                if (!displayName) throw new Error('displayName is required.');
                const body: any = {
                    'template@odata.bind': inputs.template ?? "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
                    displayName,
                };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.visibility) body.visibility = String(inputs.visibility);
                const res = await fetch(`${baseUrl}/teams`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (res.status === 202 || res.status === 201) {
                    return { output: { success: true, location: res.headers.get('Location'), displayName } };
                }
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error?.message || `Create team error: ${res.status}`);
                return { output: data };
            }

            case 'updateTeam': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const patch: any = {};
                if (inputs.displayName) patch.displayName = String(inputs.displayName);
                if (inputs.description) patch.description = String(inputs.description);
                if (inputs.visibility) patch.visibility = String(inputs.visibility);
                if (inputs.memberSettings) patch.memberSettings = inputs.memberSettings;
                if (inputs.guestSettings) patch.guestSettings = inputs.guestSettings;
                if (inputs.funSettings) patch.funSettings = inputs.funSettings;
                await graphRequest('PATCH', `/teams/${teamId}`, patch);
                return { output: { success: true, updated: teamId } };
            }

            case 'deleteTeam': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                await graphRequest('DELETE', `/groups/${teamId}`);
                return { output: { success: true, deleted: teamId } };
            }

            case 'listChannels': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await graphRequest('GET', `/teams/${teamId}/channels`);
                return { output: { channels: data.value ?? [] } };
            }

            case 'getChannel': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                if (!teamId || !channelId) throw new Error('teamId and channelId are required.');
                const data = await graphRequest('GET', `/teams/${teamId}/channels/${channelId}`);
                return { output: data };
            }

            case 'createChannel': {
                const teamId = String(inputs.teamId ?? '').trim();
                const displayName = String(inputs.displayName ?? '').trim();
                if (!teamId || !displayName) throw new Error('teamId and displayName are required.');
                const body: any = {
                    displayName,
                    membershipType: String(inputs.membershipType ?? 'standard'),
                };
                if (inputs.description) body.description = String(inputs.description);
                const data = await graphRequest('POST', `/teams/${teamId}/channels`, body);
                return { output: data };
            }

            case 'deleteChannel': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                if (!teamId || !channelId) throw new Error('teamId and channelId are required.');
                await graphRequest('DELETE', `/teams/${teamId}/channels/${channelId}`);
                return { output: { success: true, deleted: channelId } };
            }

            case 'sendMessage': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                const messageBody = String(inputs.message ?? '').trim();
                if (!teamId || !channelId || !messageBody) throw new Error('teamId, channelId, and message are required.');
                const data = await graphRequest('POST', `/teams/${teamId}/channels/${channelId}/messages`, {
                    body: { contentType: String(inputs.contentType ?? 'text'), content: messageBody },
                });
                return { output: { id: data.id, createdDateTime: data.createdDateTime, webUrl: data.webUrl } };
            }

            case 'listMessages': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                if (!teamId || !channelId) throw new Error('teamId and channelId are required.');
                const top = Math.max(1, Math.min(50, Number(inputs.top ?? 20)));
                const data = await graphRequest('GET', `/teams/${teamId}/channels/${channelId}/messages?$top=${top}`);
                return { output: { messages: data.value ?? [], nextLink: data['@odata.nextLink'] ?? null } };
            }

            case 'listMembers': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await graphRequest('GET', `/teams/${teamId}/members`);
                return { output: { members: data.value ?? [] } };
            }

            case 'addMember': {
                const teamId = String(inputs.teamId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!teamId || !userId) throw new Error('teamId and userId are required.');
                const roles = inputs.roles && Array.isArray(inputs.roles) ? inputs.roles : [];
                const data = await graphRequest('POST', `/teams/${teamId}/members`, {
                    '@odata.type': '#microsoft.graph.aadUserConversationMember',
                    roles,
                    'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${userId}')`,
                });
                return { output: data };
            }

            case 'removeMember': {
                const teamId = String(inputs.teamId ?? '').trim();
                const membershipId = String(inputs.membershipId ?? '').trim();
                if (!teamId || !membershipId) throw new Error('teamId and membershipId are required.');
                await graphRequest('DELETE', `/teams/${teamId}/members/${membershipId}`);
                return { output: { success: true, removed: membershipId } };
            }

            case 'createTab': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                const displayName = String(inputs.displayName ?? '').trim();
                const teamsAppId = String(inputs.teamsAppId ?? '').trim();
                if (!teamId || !channelId || !displayName || !teamsAppId) throw new Error('teamId, channelId, displayName, and teamsAppId are required.');
                const body: any = {
                    displayName,
                    'teamsApp@odata.bind': `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/${teamsAppId}`,
                };
                if (inputs.configuration) body.configuration = inputs.configuration;
                const data = await graphRequest('POST', `/teams/${teamId}/channels/${channelId}/tabs`, body);
                return { output: data };
            }

            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
