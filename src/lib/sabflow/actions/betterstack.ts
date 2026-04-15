'use server';

const BETTERSTACK_BASE = 'https://uptime.betterstack.com/api/v2';

async function betterstackFetch(apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[BetterStack] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${BETTERSTACK_BASE}${path}`, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.errors?.join(', ') || data?.message || `BetterStack API error: ${res.status}`);
    return data;
}

export async function executeBetterStackAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');

        const bs = (method: string, path: string, body?: any) =>
            betterstackFetch(apiToken, method, path, body, logger);

        switch (actionName) {
            case 'listMonitors': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(Number(inputs.page)));
                if (inputs.perPage) params.set('per_page', String(Number(inputs.perPage)));
                const query = params.toString();
                const data = await bs('GET', `/monitors${query ? '?' + query : ''}`);
                return { output: { monitors: data?.data ?? [], pagination: data?.pagination } };
            }

            case 'getMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const data = await bs('GET', `/monitors/${monitorId}`);
                return { output: { monitor: data?.data ?? data } };
            }

            case 'createMonitor': {
                const url = String(inputs.url ?? '').trim();
                if (!url) throw new Error('url is required.');
                const body: any = { url };
                if (inputs.monitorType) body.monitor_type = String(inputs.monitorType).trim();
                if (inputs.pronounceableName) body.pronounceable_name = String(inputs.pronounceableName).trim();
                if (inputs.checkFrequency) body.check_frequency = Number(inputs.checkFrequency);
                if (inputs.requestTimeout) body.request_timeout = Number(inputs.requestTimeout);
                if (inputs.email !== undefined) body.email = Boolean(inputs.email);
                if (inputs.teamWait !== undefined) body.team_wait = Number(inputs.teamWait);
                const data = await bs('POST', `/monitors`, body);
                return { output: { monitor: data?.data ?? data } };
            }

            case 'updateMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const body: any = {};
                if (inputs.url) body.url = String(inputs.url).trim();
                if (inputs.monitorType) body.monitor_type = String(inputs.monitorType).trim();
                if (inputs.pronounceableName) body.pronounceable_name = String(inputs.pronounceableName).trim();
                if (inputs.checkFrequency) body.check_frequency = Number(inputs.checkFrequency);
                if (inputs.requestTimeout) body.request_timeout = Number(inputs.requestTimeout);
                const data = await bs('PATCH', `/monitors/${monitorId}`, body);
                return { output: { monitor: data?.data ?? data } };
            }

            case 'deleteMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                await bs('DELETE', `/monitors/${monitorId}`);
                return { output: { success: true, monitorId } };
            }

            case 'pauseMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const data = await bs('PATCH', `/monitors/${monitorId}`, { paused: true });
                return { output: { monitor: data?.data ?? data, paused: true } };
            }

            case 'resumeMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const data = await bs('PATCH', `/monitors/${monitorId}`, { paused: false });
                return { output: { monitor: data?.data ?? data, paused: false } };
            }

            case 'listIncidents': {
                const params = new URLSearchParams();
                if (inputs.monitorId) params.set('monitor_id', String(inputs.monitorId).trim());
                if (inputs.page) params.set('page', String(Number(inputs.page)));
                const query = params.toString();
                const data = await bs('GET', `/incidents${query ? '?' + query : ''}`);
                return { output: { incidents: data?.data ?? [], pagination: data?.pagination } };
            }

            case 'getIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const data = await bs('GET', `/incidents/${incidentId}`);
                return { output: { incident: data?.data ?? data } };
            }

            case 'listStatusPages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(Number(inputs.page)));
                const query = params.toString();
                const data = await bs('GET', `/status-pages${query ? '?' + query : ''}`);
                return { output: { statusPages: data?.data ?? [], pagination: data?.pagination } };
            }

            case 'getStatusPage': {
                const statusPageId = String(inputs.statusPageId ?? '').trim();
                if (!statusPageId) throw new Error('statusPageId is required.');
                const data = await bs('GET', `/status-pages/${statusPageId}`);
                return { output: { statusPage: data?.data ?? data } };
            }

            case 'createStatusPage': {
                const companyName = String(inputs.companyName ?? '').trim();
                const companyUrl = String(inputs.companyUrl ?? '').trim();
                if (!companyName) throw new Error('companyName is required.');
                if (!companyUrl) throw new Error('companyUrl is required.');
                const body: any = { company_name: companyName, company_url: companyUrl };
                if (inputs.subdomain) body.subdomain = String(inputs.subdomain).trim();
                if (inputs.timezone) body.timezone = String(inputs.timezone).trim();
                if (inputs.customDomain) body.custom_domain = String(inputs.customDomain).trim();
                const data = await bs('POST', `/status-pages`, body);
                return { output: { statusPage: data?.data ?? data } };
            }

            case 'listHeartbeats': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(Number(inputs.page)));
                const query = params.toString();
                const data = await bs('GET', `/heartbeats${query ? '?' + query : ''}`);
                return { output: { heartbeats: data?.data ?? [], pagination: data?.pagination } };
            }

            case 'createHeartbeat': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.period) body.period = Number(inputs.period);
                if (inputs.grace) body.grace = Number(inputs.grace);
                if (inputs.email !== undefined) body.email = Boolean(inputs.email);
                if (inputs.teamId) body.team_id = String(inputs.teamId).trim();
                const data = await bs('POST', `/heartbeats`, body);
                return { output: { heartbeat: data?.data ?? data } };
            }

            case 'listOnCallSchedules': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(Number(inputs.page)));
                const query = params.toString();
                const data = await bs('GET', `/on-call-calendars${query ? '?' + query : ''}`);
                return { output: { onCallSchedules: data?.data ?? [], pagination: data?.pagination } };
            }

            default:
                throw new Error(`Unknown BetterStack action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
