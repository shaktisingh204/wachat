'use server';

export async function executeWistiaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.wistia.com/v1';
        const token = inputs.apiPassword;

        if (!token) {
            return { error: 'Missing required credential: apiPassword' };
        }

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        const get = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { headers });
            if (!res.ok) return { error: `Wistia API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const post = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            if (!res.ok) return { error: `Wistia API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const put = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
            if (!res.ok) return { error: `Wistia API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const del = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
            if (!res.ok) return { error: `Wistia API error: ${res.status} ${await res.text()}` };
            return { output: { success: true } };
        };

        switch (actionName) {
            case 'listMedias': {
                const params = new URLSearchParams();
                if (inputs.project_id) params.set('project_id', inputs.project_id);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.per_page) params.set('per_page', String(inputs.per_page));
                return get(`/medias.json?${params}`);
            }

            case 'getMedia': {
                if (!inputs.mediaHashedId) return { error: 'Missing required input: mediaHashedId' };
                return get(`/medias/${inputs.mediaHashedId}.json`);
            }

            case 'uploadMedia': {
                if (!inputs.url && !inputs.file) return { error: 'Missing required input: url or file' };
                const body: any = {};
                if (inputs.url) body.url = inputs.url;
                if (inputs.project_id) body.project_id = inputs.project_id;
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                return post('/medias.json', body);
            }

            case 'updateMedia': {
                if (!inputs.mediaHashedId) return { error: 'Missing required input: mediaHashedId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.project_id) body.project_id = inputs.project_id;
                return put(`/medias/${inputs.mediaHashedId}.json`, body);
            }

            case 'deleteMedia': {
                if (!inputs.mediaHashedId) return { error: 'Missing required input: mediaHashedId' };
                return del(`/medias/${inputs.mediaHashedId}.json`);
            }

            case 'listProjects': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.per_page) params.set('per_page', String(inputs.per_page));
                return get(`/projects.json?${params}`);
            }

            case 'getProject': {
                if (!inputs.projectHashedId) return { error: 'Missing required input: projectHashedId' };
                return get(`/projects/${inputs.projectHashedId}.json`);
            }

            case 'createProject': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                const body: any = { name: inputs.name };
                if (inputs.anonymousCanUpload !== undefined) body.anonymousCanUpload = inputs.anonymousCanUpload;
                if (inputs.anonymousCanDownload !== undefined) body.anonymousCanDownload = inputs.anonymousCanDownload;
                if (inputs.public !== undefined) body.public = inputs.public;
                return post('/projects.json', body);
            }

            case 'updateProject': {
                if (!inputs.projectHashedId) return { error: 'Missing required input: projectHashedId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.anonymousCanUpload !== undefined) body.anonymousCanUpload = inputs.anonymousCanUpload;
                if (inputs.anonymousCanDownload !== undefined) body.anonymousCanDownload = inputs.anonymousCanDownload;
                if (inputs.public !== undefined) body.public = inputs.public;
                return put(`/projects/${inputs.projectHashedId}.json`, body);
            }

            case 'deleteProject': {
                if (!inputs.projectHashedId) return { error: 'Missing required input: projectHashedId' };
                return del(`/projects/${inputs.projectHashedId}.json`);
            }

            case 'listStatsEvents': {
                const params = new URLSearchParams();
                if (inputs.media_id) params.set('media_id', inputs.media_id);
                if (inputs.start_date) params.set('start_date', inputs.start_date);
                if (inputs.end_date) params.set('end_date', inputs.end_date);
                if (inputs.page) params.set('page', String(inputs.page));
                return get(`/stats/events.json?${params}`);
            }

            case 'getMediaStats': {
                if (!inputs.mediaHashedId) return { error: 'Missing required input: mediaHashedId' };
                return get(`/stats/medias/${inputs.mediaHashedId}.json`);
            }

            case 'getAccountStats': {
                const params = new URLSearchParams();
                if (inputs.start_date) params.set('start_date', inputs.start_date);
                if (inputs.end_date) params.set('end_date', inputs.end_date);
                return get(`/stats/account.json?${params}`);
            }

            case 'listEmbedCodes': {
                if (!inputs.mediaHashedId) return { error: 'Missing required input: mediaHashedId' };
                return get(`/medias/${inputs.mediaHashedId}/embed_code.json`);
            }

            case 'copyMedia': {
                if (!inputs.mediaHashedId) return { error: 'Missing required input: mediaHashedId' };
                const body: any = {};
                if (inputs.project_id) body.project_id = inputs.project_id;
                const res = await fetch(`${baseUrl}/medias/${inputs.mediaHashedId}/copy.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Wistia API error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown Wistia action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeWistiaAction error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in executeWistiaAction' };
    }
}
