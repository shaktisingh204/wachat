
'use server';

async function posthogApiFetch(apiKey: string, host: string, method: string, path: string, body?: any, logger?: any) {
    const url = `${host}/api${path}`;
    logger?.log(`[PostHog] ${method} ${url}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.detail || data?.message || `PostHog API error: ${res.status}`);
    return data;
}

async function posthogCapture(host: string, publicKey: string, payload: any, logger?: any) {
    const url = `${host}/capture/`;
    logger?.log(`[PostHog] POST ${url}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: publicKey, ...payload }),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.detail || data?.message || `PostHog capture error: ${res.status}`);
    return data;
}

export async function executePosthogAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const projectId = String(inputs.projectId ?? '').trim();
        const host = String(inputs.host ?? 'https://app.posthog.com').replace(/\/$/, '');
        if (!apiKey) throw new Error('apiKey is required.');
        if (!projectId) throw new Error('projectId is required.');
        const api = (method: string, path: string, body?: any) => posthogApiFetch(apiKey, host, method, path, body, logger);
        const proj = `/projects/${projectId}`;

        switch (actionName) {
            case 'captureEvent': {
                const distinctId = String(inputs.distinctId ?? '').trim();
                const event = String(inputs.event ?? '').trim();
                if (!distinctId || !event) throw new Error('distinctId and event are required.');
                const publicKey = String(inputs.publicKey ?? apiKey).trim();
                const properties = inputs.properties
                    ? (typeof inputs.properties === 'string' ? JSON.parse(inputs.properties) : inputs.properties)
                    : {};
                const data = await posthogCapture(host, publicKey, { distinct_id: distinctId, event, properties }, logger);
                return { output: { success: true, status: data.status ?? 1 } };
            }

            case 'getPersons': {
                const limit = Number(inputs.limit ?? 100);
                const search = inputs.search ? String(inputs.search).trim() : undefined;
                const params = new URLSearchParams({ limit: String(limit) });
                if (search) params.set('search', search);
                const data = await api('GET', `${proj}/persons/?${params.toString()}`);
                return { output: { persons: data.results ?? [], count: data.count ?? 0, next: data.next ?? null } };
            }

            case 'getPerson': {
                const distinctId = String(inputs.distinctId ?? '').trim();
                if (!distinctId) throw new Error('distinctId is required.');
                const data = await api('GET', `${proj}/persons/?distinct_id=${encodeURIComponent(distinctId)}`);
                const person = data.results?.[0] ?? null;
                return { output: { person } };
            }

            case 'getPersonProperties': {
                const personId = String(inputs.personId ?? '').trim();
                if (!personId) throw new Error('personId is required.');
                const data = await api('GET', `${proj}/persons/${personId}/properties/`);
                return { output: { properties: data.results ?? data } };
            }

            case 'updatePersonProperties': {
                const distinctId = String(inputs.distinctId ?? '').trim();
                if (!distinctId) throw new Error('distinctId is required.');
                const properties = typeof inputs.properties === 'string' ? JSON.parse(inputs.properties) : inputs.properties;
                if (!properties || typeof properties !== 'object') throw new Error('properties must be an object.');
                const publicKey = String(inputs.publicKey ?? apiKey).trim();
                const data = await posthogCapture(host, publicKey, {
                    distinct_id: distinctId,
                    event: '$set',
                    properties: { $set: properties },
                }, logger);
                return { output: { success: true, status: data.status ?? 1 } };
            }

            case 'createFeatureFlag': {
                const key = String(inputs.key ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const rolloutPercentage = Number(inputs.rolloutPercentage ?? 100);
                if (!key || !name) throw new Error('key and name are required.');
                const body = {
                    key,
                    name,
                    filters: {
                        groups: [{ rollout_percentage: rolloutPercentage }],
                    },
                    active: true,
                };
                const data = await api('POST', `${proj}/feature_flags/`, body);
                return { output: { id: data.id, key: data.key, name: data.name, active: data.active } };
            }

            case 'listFeatureFlags': {
                const data = await api('GET', `${proj}/feature_flags/`);
                return { output: { flags: data.results ?? [], count: data.count ?? 0 } };
            }

            case 'getFeatureFlag': {
                const flagId = String(inputs.flagId ?? '').trim();
                if (!flagId) throw new Error('flagId is required.');
                const data = await api('GET', `${proj}/feature_flags/${flagId}/`);
                return { output: { flag: data } };
            }

            case 'updateFeatureFlag': {
                const flagId = String(inputs.flagId ?? '').trim();
                if (!flagId) throw new Error('flagId is required.');
                const body: any = {};
                if (inputs.active !== undefined) body.active = inputs.active === true || inputs.active === 'true';
                if (inputs.rolloutPercentage !== undefined) {
                    body.filters = {
                        groups: [{ rollout_percentage: Number(inputs.rolloutPercentage) }],
                    };
                }
                const data = await api('PATCH', `${proj}/feature_flags/${flagId}/`, body);
                return { output: { id: data.id, key: data.key, active: data.active } };
            }

            case 'getInsights': {
                const limit = Number(inputs.limit ?? 20);
                const data = await api('GET', `${proj}/insights/?limit=${limit}`);
                return { output: { insights: data.results ?? [], count: data.count ?? 0 } };
            }

            case 'getDashboards': {
                const data = await api('GET', `${proj}/dashboards/`);
                return { output: { dashboards: data.results ?? [], count: data.count ?? 0 } };
            }

            case 'getAnnotations': {
                const limit = Number(inputs.limit ?? 20);
                const data = await api('GET', `${proj}/annotations/?limit=${limit}`);
                return { output: { annotations: data.results ?? [], count: data.count ?? 0 } };
            }

            case 'createAnnotation': {
                const content = String(inputs.content ?? '').trim();
                const dateMarker = String(inputs.dateMarker ?? '').trim();
                const scope = String(inputs.scope ?? 'organization');
                if (!content || !dateMarker) throw new Error('content and dateMarker are required.');
                const data = await api('POST', `${proj}/annotations/`, { content, date_marker: dateMarker, scope });
                return { output: { id: data.id, content: data.content, dateMarker: data.date_marker, scope: data.scope } };
            }

            case 'getEvents': {
                const params = new URLSearchParams({ limit: String(Number(inputs.limit ?? 50)) });
                if (inputs.event) params.set('event', String(inputs.event).trim());
                if (inputs.distinctId) params.set('distinct_id', String(inputs.distinctId).trim());
                if (inputs.after) params.set('after', String(inputs.after).trim());
                if (inputs.before) params.set('before', String(inputs.before).trim());
                const data = await api('GET', `${proj}/events/?${params.toString()}`);
                return { output: { events: data.results ?? [], count: data.count ?? 0, next: data.next ?? null } };
            }

            default:
                throw new Error(`Unknown PostHog action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
