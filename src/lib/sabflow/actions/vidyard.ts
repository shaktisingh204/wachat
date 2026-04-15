'use server';

export async function executeVidyardAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.vidyard.com/dashboard/v1';
        const token = inputs.authToken;

        if (!token) {
            return { error: 'Missing required credential: authToken' };
        }

        const headers: Record<string, string> = {
            'X-Auth-Token': token,
            'Content-Type': 'application/json',
        };

        const get = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { headers });
            if (!res.ok) return { error: `Vidyard API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const post = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            if (!res.ok) return { error: `Vidyard API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const put = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
            if (!res.ok) return { error: `Vidyard API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const del = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
            if (!res.ok) return { error: `Vidyard API error: ${res.status} ${await res.text()}` };
            return { output: { success: true } };
        };

        switch (actionName) {
            case 'listPlayers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.per_page) params.set('per_page', String(inputs.per_page));
                return get(`/players?${params}`);
            }

            case 'getPlayer': {
                if (!inputs.playerId) return { error: 'Missing required input: playerId' };
                return get(`/players/${inputs.playerId}`);
            }

            case 'createPlayer': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.chapters) body.chapters = inputs.chapters;
                return post('/players', body);
            }

            case 'updatePlayer': {
                if (!inputs.playerId) return { error: 'Missing required input: playerId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                return put(`/players/${inputs.playerId}`, body);
            }

            case 'deletePlayer': {
                if (!inputs.playerId) return { error: 'Missing required input: playerId' };
                return del(`/players/${inputs.playerId}`);
            }

            case 'listGroups': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.per_page) params.set('per_page', String(inputs.per_page));
                return get(`/groups?${params}`);
            }

            case 'getGroup': {
                if (!inputs.groupId) return { error: 'Missing required input: groupId' };
                return get(`/groups/${inputs.groupId}`);
            }

            case 'listAnalytics': {
                const params = new URLSearchParams();
                if (inputs.start_date) params.set('start_date', inputs.start_date);
                if (inputs.end_date) params.set('end_date', inputs.end_date);
                if (inputs.page) params.set('page', String(inputs.page));
                return get(`/analytics/video_plays?${params}`);
            }

            case 'getPlayerAnalytics': {
                if (!inputs.playerId) return { error: 'Missing required input: playerId' };
                const params = new URLSearchParams();
                if (inputs.start_date) params.set('start_date', inputs.start_date);
                if (inputs.end_date) params.set('end_date', inputs.end_date);
                return get(`/analytics/players/${inputs.playerId}?${params}`);
            }

            case 'listViewers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.per_page) params.set('per_page', String(inputs.per_page));
                if (inputs.email) params.set('email', inputs.email);
                return get(`/viewers?${params}`);
            }

            case 'getViewer': {
                if (!inputs.viewerId) return { error: 'Missing required input: viewerId' };
                return get(`/viewers/${inputs.viewerId}`);
            }

            case 'listEvents': {
                const params = new URLSearchParams();
                if (inputs.player_uuid) params.set('player_uuid', inputs.player_uuid);
                if (inputs.viewer_uuid) params.set('viewer_uuid', inputs.viewer_uuid);
                if (inputs.page) params.set('page', String(inputs.page));
                return get(`/events?${params}`);
            }

            case 'getEvent': {
                if (!inputs.eventId) return { error: 'Missing required input: eventId' };
                return get(`/events/${inputs.eventId}`);
            }

            case 'updatePlayerTheme': {
                if (!inputs.playerId) return { error: 'Missing required input: playerId' };
                const body: any = {};
                if (inputs.color) body.color = inputs.color;
                if (inputs.controlbar_color) body.controlbar_color = inputs.controlbar_color;
                if (inputs.logo) body.logo = inputs.logo;
                return put(`/players/${inputs.playerId}/theme`, body);
            }

            case 'listChapters': {
                if (!inputs.playerId) return { error: 'Missing required input: playerId' };
                return get(`/players/${inputs.playerId}/chapters`);
            }

            default:
                return { error: `Unknown Vidyard action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeVidyardAction error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in executeVidyardAction' };
    }
}
