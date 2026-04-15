
'use server';

async function umamiAuth(baseUrl: string, username: string, password: string, logger?: any): Promise<string> {
    logger?.log('[Umami] Authenticating...');
    const cleanBase = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Umami auth error: ${res.status}`);
    return data.token;
}

async function umamiFetch(baseUrl: string, token: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Umami] ${method} ${path}`);
    const cleanBase = baseUrl.replace(/\/$/, '');
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${cleanBase}/api${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Umami API error: ${res.status}`);
    }
    return data;
}

export async function executeUmamiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = String(inputs.baseUrl ?? '').trim();
        const username = String(inputs.username ?? '').trim();
        const password = String(inputs.password ?? '').trim();
        if (!baseUrl) throw new Error('baseUrl is required.');
        if (!username || !password) throw new Error('username and password are required.');
        const token = await umamiAuth(baseUrl, username, password, logger);
        const um = (method: string, path: string, body?: any) => umamiFetch(baseUrl, token, method, path, body, logger);

        switch (actionName) {
            case 'getWebsiteStats': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                const startAt = Number(inputs.startAt ?? Date.now() - 7 * 24 * 60 * 60 * 1000);
                const endAt = Number(inputs.endAt ?? Date.now());
                const params = new URLSearchParams({ startAt: String(startAt), endAt: String(endAt) });
                const data = await um('GET', `/websites/${websiteId}/stats?${params.toString()}`);
                return { output: { pageviews: JSON.stringify(data.pageviews ?? {}), visitors: JSON.stringify(data.uniques ?? {}), bounceRate: JSON.stringify(data.bounces ?? {}), totalTime: JSON.stringify(data.totaltime ?? {}) } };
            }

            case 'getPageviews': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                const startAt = Number(inputs.startAt ?? Date.now() - 7 * 24 * 60 * 60 * 1000);
                const endAt = Number(inputs.endAt ?? Date.now());
                const unit = inputs.unit ?? 'day';
                const timezone = inputs.timezone ?? 'UTC';
                const params = new URLSearchParams({ startAt: String(startAt), endAt: String(endAt), unit, timezone });
                const data = await um('GET', `/websites/${websiteId}/pageviews?${params.toString()}`);
                return { output: { pageviews: JSON.stringify(data.pageviews ?? []), sessions: JSON.stringify(data.sessions ?? []) } };
            }

            case 'getSessions': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                const startAt = Number(inputs.startAt ?? Date.now() - 7 * 24 * 60 * 60 * 1000);
                const endAt = Number(inputs.endAt ?? Date.now());
                const params = new URLSearchParams({ startAt: String(startAt), endAt: String(endAt) });
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const data = await um('GET', `/websites/${websiteId}/sessions?${params.toString()}`);
                const sessions = data.data ?? [];
                return { output: { count: String(data.count ?? sessions.length), sessions: JSON.stringify(sessions) } };
            }

            case 'getEvents': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                const startAt = Number(inputs.startAt ?? Date.now() - 7 * 24 * 60 * 60 * 1000);
                const endAt = Number(inputs.endAt ?? Date.now());
                const unit = inputs.unit ?? 'day';
                const timezone = inputs.timezone ?? 'UTC';
                const params = new URLSearchParams({ startAt: String(startAt), endAt: String(endAt), unit, timezone });
                if (inputs.eventName) params.set('url', String(inputs.eventName));
                const data = await um('GET', `/websites/${websiteId}/events?${params.toString()}`);
                return { output: { events: JSON.stringify(data ?? []) } };
            }

            case 'listWebsites': {
                const data = await um('GET', '/websites');
                const websites = data.data ?? [];
                return { output: { count: String(data.count ?? websites.length), websites: JSON.stringify(websites) } };
            }

            case 'getMetrics': {
                const websiteId = String(inputs.websiteId ?? '').trim();
                const type = String(inputs.type ?? 'url').trim();
                if (!websiteId) throw new Error('websiteId is required.');
                const startAt = Number(inputs.startAt ?? Date.now() - 7 * 24 * 60 * 60 * 1000);
                const endAt = Number(inputs.endAt ?? Date.now());
                const params = new URLSearchParams({ startAt: String(startAt), endAt: String(endAt), type });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await um('GET', `/websites/${websiteId}/metrics?${params.toString()}`);
                return { output: { count: String(data.length ?? 0), metrics: JSON.stringify(data ?? []) } };
            }

            default:
                return { error: `Umami action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Umami action failed.' };
    }
}
