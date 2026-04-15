
'use server';

const DUB_BASE = 'https://api.dub.co';

async function dubFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Dub] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${DUB_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `Dub API error: ${res.status}`);
    }
    return data;
}

export async function executeDubAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const dub = (method: string, path: string, body?: any) => dubFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'createLink': {
                const url = String(inputs.url ?? '').trim();
                if (!url) throw new Error('url is required.');
                const payload: any = { url };
                if (inputs.domain) payload.domain = String(inputs.domain);
                if (inputs.key) payload.key = String(inputs.key);
                if (inputs.title) payload.title = String(inputs.title);
                if (inputs.description) payload.description = String(inputs.description);
                if (inputs.expiresAt) payload.expiresAt = String(inputs.expiresAt);
                if (inputs.password) payload.password = String(inputs.password);
                if (inputs.ios) payload.ios = String(inputs.ios);
                if (inputs.android) payload.android = String(inputs.android);
                if (inputs.geo) payload.geo = typeof inputs.geo === 'string' ? JSON.parse(inputs.geo) : inputs.geo;
                if (inputs.publicStats !== undefined) payload.publicStats = inputs.publicStats === true || inputs.publicStats === 'true';
                const data = await dub('POST', '/links', payload);
                return { output: { id: data.id ?? '', shortLink: data.shortLink ?? '', key: data.key ?? '', domain: data.domain ?? '' } };
            }

            case 'getLink': {
                const linkId = String(inputs.linkId ?? '').trim();
                const domain = String(inputs.domain ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                if (!linkId && (!domain || !key)) throw new Error('linkId or (domain + key) is required.');
                let path = linkId ? `/links/${linkId}` : `/links/info?domain=${encodeURIComponent(domain)}&key=${encodeURIComponent(key)}`;
                const data = await dub('GET', path);
                return { output: { id: data.id ?? '', shortLink: data.shortLink ?? '', url: data.url ?? '', clicks: String(data.clicks ?? 0) } };
            }

            case 'updateLink': {
                const linkId = String(inputs.linkId ?? '').trim();
                if (!linkId) throw new Error('linkId is required.');
                const payload: any = {};
                if (inputs.url) payload.url = String(inputs.url);
                if (inputs.title) payload.title = String(inputs.title);
                if (inputs.description) payload.description = String(inputs.description);
                if (inputs.key) payload.key = String(inputs.key);
                if (inputs.expiresAt) payload.expiresAt = String(inputs.expiresAt);
                const data = await dub('PATCH', `/links/${linkId}`, payload);
                return { output: { id: data.id ?? linkId, shortLink: data.shortLink ?? '', url: data.url ?? '' } };
            }

            case 'deleteLink': {
                const linkId = String(inputs.linkId ?? '').trim();
                if (!linkId) throw new Error('linkId is required.');
                const data = await dub('DELETE', `/links/${linkId}`);
                return { output: { success: 'true', id: data.id ?? linkId } };
            }

            case 'getLinkStats': {
                const domain = String(inputs.domain ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                const linkId = String(inputs.linkId ?? '').trim();
                if (!linkId && (!domain || !key)) throw new Error('linkId or (domain + key) is required.');
                const params = new URLSearchParams();
                if (domain) params.set('domain', domain);
                if (key) params.set('key', key);
                if (inputs.interval) params.set('interval', String(inputs.interval));
                const path = linkId
                    ? `/links/${linkId}/stats?${params.toString()}`
                    : `/stats?${params.toString()}`;
                const data = await dub('GET', path);
                return { output: { clicks: String(data.clicks ?? 0), stats: JSON.stringify(data) } };
            }

            case 'listLinks': {
                const params = new URLSearchParams();
                if (inputs.domain) params.set('domain', String(inputs.domain));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.search) params.set('search', String(inputs.search));
                if (inputs.sort) params.set('sort', String(inputs.sort));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dub('GET', `/links${qs}`);
                return { output: { count: String(data.length ?? 0), links: JSON.stringify(data) } };
            }

            default:
                return { error: `Dub action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Dub action failed.' };
    }
}
