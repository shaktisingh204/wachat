
'use server';

async function kumaFetch(serverUrl: string, apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[UptimeKuma] ${method} ${path}`);
    const base = serverUrl.replace(/\/$/, '');
    const url = `${base}/api${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.msg || data?.message || data?.error || `Uptime Kuma API error: ${res.status}`);
    }
    return data;
}

export async function executeUptimeKumaAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!serverUrl) throw new Error('serverUrl is required.');
        const k = (method: string, path: string, body?: any) => kumaFetch(serverUrl, apiKey, method, path, body, logger);

        switch (actionName) {
            case 'getMonitors': {
                const data = await k('GET', '/monitors');
                const monitors = data.monitors ?? data;
                return { output: { monitors: Array.isArray(monitors) ? monitors : [], count: Array.isArray(monitors) ? monitors.length : 0 } };
            }

            case 'getMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const data = await k('GET', `/monitors/${monitorId}`);
                const m = data.monitor ?? data;
                return { output: { id: String(m.id), name: m.name, url: m.url ?? '', type: m.type ?? '', active: String(m.active ?? true) } };
            }

            case 'addMonitor': {
                const name = String(inputs.name ?? '').trim();
                const type = String(inputs.type ?? 'http').trim();
                if (!name) throw new Error('name is required.');
                const body: any = {
                    name,
                    type,
                    url: inputs.url ? String(inputs.url) : undefined,
                    interval: Number(inputs.interval ?? 60),
                    retryInterval: Number(inputs.retryInterval ?? 60),
                    maxretries: Number(inputs.maxRetries ?? 0),
                };
                const data = await k('POST', '/monitors', body);
                return { output: { id: String(data.monitorID ?? data.id ?? ''), name, type } };
            }

            case 'editMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.url) body.url = String(inputs.url);
                if (inputs.interval) body.interval = Number(inputs.interval);
                if (inputs.active !== undefined) body.active = inputs.active === true || inputs.active === 'true';
                const data = await k('PUT', `/monitors/${monitorId}`, body);
                return { output: { id: String(data.monitorID ?? monitorId), updated: 'true' } };
            }

            case 'deleteMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                await k('DELETE', `/monitors/${monitorId}`);
                return { output: { deleted: 'true', monitorId } };
            }

            case 'pauseMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                await k('PATCH', `/monitors/${monitorId}/pause`);
                return { output: { monitorId, paused: 'true' } };
            }

            case 'resumeMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                await k('PATCH', `/monitors/${monitorId}/resume`);
                return { output: { monitorId, paused: 'false' } };
            }

            case 'getHeartbeatList': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const important = inputs.important === true || inputs.important === 'true' ? '?important=1' : '';
                const data = await k('GET', `/monitors/${monitorId}/beats${important}`);
                const beats = data.heartbeatList ?? data;
                return { output: { heartbeats: Array.isArray(beats) ? beats : [], count: Array.isArray(beats) ? beats.length : 0 } };
            }

            case 'getImportantHeartbeatList': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const data = await k('GET', `/monitors/${monitorId}/beats?important=1`);
                const beats = data.heartbeatList ?? data;
                return { output: { heartbeats: Array.isArray(beats) ? beats : [], count: Array.isArray(beats) ? beats.length : 0 } };
            }

            case 'getStatus': {
                const data = await k('GET', '/status');
                return { output: { status: data.status ?? 'ok', version: data.version ?? '', uptime: String(data.uptime ?? '') } };
            }

            case 'getStatusPage': {
                const slug = String(inputs.slug ?? '').trim();
                if (!slug) throw new Error('slug is required.');
                const data = await k('GET', `/status-page/${slug}`);
                return { output: { id: String(data.id ?? ''), slug: data.slug ?? slug, title: data.title ?? '', publicGroupList: data.publicGroupList ?? [] } };
            }

            case 'addStatusPage': {
                const slug = String(inputs.slug ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!slug || !title) throw new Error('slug and title are required.');
                const data = await k('POST', '/status-pages', { slug, title, description: inputs.description ?? '' });
                return { output: { id: String(data.id ?? ''), slug, title } };
            }

            case 'deleteStatusPage': {
                const slug = String(inputs.slug ?? '').trim();
                if (!slug) throw new Error('slug is required.');
                await k('DELETE', `/status-pages/${slug}`);
                return { output: { deleted: 'true', slug } };
            }

            case 'getUptimeStats': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const period = Number(inputs.period ?? 24);
                const data = await k('GET', `/monitors/${monitorId}/uptime/${period}`);
                return { output: { monitorId, period: String(period), uptime: String(data.uptime ?? data), uptimePercent: String(data.uptimePercent ?? '') } };
            }

            default:
                return { error: `Uptime Kuma action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Uptime Kuma action failed.' };
    }
}
