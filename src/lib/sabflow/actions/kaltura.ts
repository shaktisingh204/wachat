'use server';

export async function executeKalturaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const secret = inputs.secret;
        const userId = inputs.userId;
        const partnerId = inputs.partnerId;
        const serviceUrl = inputs.serviceUrl || 'https://www.kaltura.com/api_v3';

        if (!secret || !partnerId) {
            return { error: 'Missing required credentials: secret and partnerId' };
        }

        // Start a Kaltura session to obtain a ks token
        const sessionRes = await fetch(
            `${serviceUrl}/service/session/action/start?secret=${encodeURIComponent(secret)}&userId=${encodeURIComponent(userId || '')}&type=0&partnerId=${encodeURIComponent(partnerId)}&format=1`,
            { method: 'GET' }
        );
        if (!sessionRes.ok) {
            return { error: `Kaltura session error: ${sessionRes.status} ${await sessionRes.text()}` };
        }
        const ks = (await sessionRes.json()) as string;
        if (!ks || typeof ks !== 'string') {
            return { error: 'Failed to obtain Kaltura session (ks)' };
        }

        const call = async (service: string, action: string, params: Record<string, any> = {}) => {
            const body = new URLSearchParams({ ks, format: '1', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
            const res = await fetch(`${serviceUrl}/service/${service}/action/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
            });
            if (!res.ok) return { error: `Kaltura API error: ${res.status} ${await res.text()}` };
            const data = await res.json();
            if (data?.code && data?.message) return { error: `Kaltura error ${data.code}: ${data.message}` };
            return { output: data };
        };

        switch (actionName) {
            case 'listMedia': {
                const params: Record<string, any> = {};
                if (inputs.pageSize) params['filter:pageSize'] = inputs.pageSize;
                if (inputs.pageIndex) params['filter:pageIndex'] = inputs.pageIndex;
                if (inputs.mediaType) params['filter:mediaTypeEqual'] = inputs.mediaType;
                if (inputs.nameLike) params['filter:nameLike'] = inputs.nameLike;
                return call('media', 'list', params);
            }

            case 'getMedia': {
                if (!inputs.entryId) return { error: 'Missing required input: entryId' };
                return call('media', 'get', { entryId: inputs.entryId });
            }

            case 'addMedia': {
                if (!inputs.mediaType) return { error: 'Missing required input: mediaType' };
                const params: Record<string, any> = { 'entry:objectType': 'KalturaMediaEntry', 'entry:mediaType': inputs.mediaType };
                if (inputs.name) params['entry:name'] = inputs.name;
                if (inputs.description) params['entry:description'] = inputs.description;
                if (inputs.tags) params['entry:tags'] = inputs.tags;
                return call('media', 'add', params);
            }

            case 'updateMedia': {
                if (!inputs.entryId) return { error: 'Missing required input: entryId' };
                const params: Record<string, any> = { entryId: inputs.entryId, 'mediaEntry:objectType': 'KalturaMediaEntry' };
                if (inputs.name) params['mediaEntry:name'] = inputs.name;
                if (inputs.description) params['mediaEntry:description'] = inputs.description;
                if (inputs.tags) params['mediaEntry:tags'] = inputs.tags;
                return call('media', 'update', params);
            }

            case 'deleteMedia': {
                if (!inputs.entryId) return { error: 'Missing required input: entryId' };
                return call('media', 'delete', { entryId: inputs.entryId });
            }

            case 'uploadMedia': {
                if (!inputs.entryId) return { error: 'Missing required input: entryId' };
                const params: Record<string, any> = { entryId: inputs.entryId };
                if (inputs.url) params.url = inputs.url;
                return call('media', 'addContent', params);
            }

            case 'listCategories': {
                const params: Record<string, any> = {};
                if (inputs.pageSize) params['filter:pageSize'] = inputs.pageSize;
                if (inputs.pageIndex) params['filter:pageIndex'] = inputs.pageIndex;
                if (inputs.fullNameLike) params['filter:fullNameLike'] = inputs.fullNameLike;
                return call('category', 'list', params);
            }

            case 'getCategory': {
                if (!inputs.id) return { error: 'Missing required input: id' };
                return call('category', 'get', { id: inputs.id });
            }

            case 'listUsers': {
                const params: Record<string, any> = {};
                if (inputs.pageSize) params['filter:pageSize'] = inputs.pageSize;
                if (inputs.pageIndex) params['filter:pageIndex'] = inputs.pageIndex;
                if (inputs.idEqual) params['filter:idEqual'] = inputs.idEqual;
                return call('user', 'list', params);
            }

            case 'getUser': {
                if (!inputs.userId) return { error: 'Missing required input: userId' };
                return call('user', 'get', { userId: inputs.userId });
            }

            case 'addUser': {
                if (!inputs.id) return { error: 'Missing required input: id' };
                const params: Record<string, any> = { 'user:objectType': 'KalturaUser', 'user:id': inputs.id };
                if (inputs.email) params['user:email'] = inputs.email;
                if (inputs.firstName) params['user:firstName'] = inputs.firstName;
                if (inputs.lastName) params['user:lastName'] = inputs.lastName;
                if (inputs.roleIds) params['user:roleIds'] = inputs.roleIds;
                return call('user', 'add', params);
            }

            case 'listPlaylists': {
                const params: Record<string, any> = {};
                if (inputs.pageSize) params['filter:pageSize'] = inputs.pageSize;
                if (inputs.pageIndex) params['filter:pageIndex'] = inputs.pageIndex;
                if (inputs.nameLike) params['filter:nameLike'] = inputs.nameLike;
                return call('playlist', 'list', params);
            }

            case 'getPlaylist': {
                if (!inputs.id) return { error: 'Missing required input: id' };
                return call('playlist', 'get', { id: inputs.id });
            }

            case 'addPlaylist': {
                if (!inputs.name || !inputs.playlistType) return { error: 'Missing required inputs: name and playlistType' };
                const params: Record<string, any> = {
                    'playlist:objectType': 'KalturaPlaylist',
                    'playlist:name': inputs.name,
                    'playlist:playlistType': inputs.playlistType,
                };
                if (inputs.description) params['playlist:description'] = inputs.description;
                if (inputs.playlistContent) params['playlist:playlistContent'] = inputs.playlistContent;
                return call('playlist', 'add', params);
            }

            case 'getReport': {
                if (!inputs.reportType) return { error: 'Missing required input: reportType' };
                const params: Record<string, any> = {
                    'reportInputFilter:objectType': 'KalturaReportInputFilter',
                    reportType: inputs.reportType,
                };
                if (inputs.fromDate) params['reportInputFilter:fromDate'] = inputs.fromDate;
                if (inputs.toDate) params['reportInputFilter:toDate'] = inputs.toDate;
                if (inputs.entryIdIn) params['reportInputFilter:entryIdIn'] = inputs.entryIdIn;
                if (inputs.pageSize) params.pageSize = inputs.pageSize;
                if (inputs.pageIndex) params.pageIndex = inputs.pageIndex;
                return call('report', 'getTable', params);
            }

            default:
                return { error: `Unknown Kaltura action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeKalturaAction error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in executeKalturaAction' };
    }
}
