'use server';

async function buFetch(apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[BetterUptime] ${method} ${path}`);
    const url = `https://betteruptime.com/api/v2${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errors || data?.message || `BetterUptime API error: ${res.status}`);
    }
    return data;
}

export async function executeBetterUptimeAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');
        const bu = (method: string, path: string, body?: any) => buFetch(apiToken, method, path, body, logger);

        switch (actionName) {
            case 'listMonitors': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.url) params.set('url', inputs.url);
                const data = await bu('GET', `/monitors?${params.toString()}`);
                return { output: data };
            }

            case 'getMonitor': {
                if (!inputs.monitorId) throw new Error('monitorId is required.');
                const data = await bu('GET', `/monitors/${inputs.monitorId}`);
                return { output: data };
            }

            case 'createMonitor': {
                if (!inputs.url) throw new Error('url is required.');
                const body: any = { url: inputs.url };
                if (inputs.monitorType) body.monitor_type = inputs.monitorType;
                if (inputs.requiredKeyword) body.required_keyword = inputs.requiredKeyword;
                if (inputs.checkFrequency) body.check_frequency = inputs.checkFrequency;
                if (inputs.requestTimeout) body.request_timeout = inputs.requestTimeout;
                if (inputs.email !== undefined) body.email = inputs.email;
                if (inputs.paused !== undefined) body.paused = inputs.paused;
                if (inputs.regions) body.regions = Array.isArray(inputs.regions) ? inputs.regions : inputs.regions.split(',');
                const data = await bu('POST', '/monitors', body);
                return { output: data };
            }

            case 'updateMonitor': {
                if (!inputs.monitorId) throw new Error('monitorId is required.');
                const body: any = {};
                if (inputs.url) body.url = inputs.url;
                if (inputs.requiredKeyword) body.required_keyword = inputs.requiredKeyword;
                if (inputs.checkFrequency) body.check_frequency = inputs.checkFrequency;
                if (inputs.requestTimeout) body.request_timeout = inputs.requestTimeout;
                if (inputs.email !== undefined) body.email = inputs.email;
                const data = await bu('PATCH', `/monitors/${inputs.monitorId}`, body);
                return { output: data };
            }

            case 'deleteMonitor': {
                if (!inputs.monitorId) throw new Error('monitorId is required.');
                await bu('DELETE', `/monitors/${inputs.monitorId}`);
                return { output: { success: true, monitorId: inputs.monitorId } };
            }

            case 'pauseMonitor': {
                if (!inputs.monitorId) throw new Error('monitorId is required.');
                const data = await bu('PATCH', `/monitors/${inputs.monitorId}`, { paused: true });
                return { output: data };
            }

            case 'resumeMonitor': {
                if (!inputs.monitorId) throw new Error('monitorId is required.');
                const data = await bu('PATCH', `/monitors/${inputs.monitorId}`, { paused: false });
                return { output: data };
            }

            case 'listIncidents': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                const data = await bu('GET', `/incidents?${params.toString()}`);
                return { output: data };
            }

            case 'getIncident': {
                if (!inputs.incidentId) throw new Error('incidentId is required.');
                const data = await bu('GET', `/incidents/${inputs.incidentId}`);
                return { output: data };
            }

            case 'listStatusPages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await bu('GET', `/status-pages?${params.toString()}`);
                return { output: data };
            }

            case 'getStatusPage': {
                if (!inputs.statusPageId) throw new Error('statusPageId is required.');
                const data = await bu('GET', `/status-pages/${inputs.statusPageId}`);
                return { output: data };
            }

            case 'createStatusPage': {
                if (!inputs.companyName) throw new Error('companyName is required.');
                if (!inputs.subdomain) throw new Error('subdomain is required.');
                const body: any = {
                    company_name: inputs.companyName,
                    subdomain: inputs.subdomain,
                };
                if (inputs.timezone) body.timezone = inputs.timezone;
                if (inputs.subscribable !== undefined) body.subscribable = inputs.subscribable;
                if (inputs.hideFromSearch !== undefined) body.hide_from_search_engines = inputs.hideFromSearch;
                const data = await bu('POST', '/status-pages', body);
                return { output: data };
            }

            case 'updateStatusPage': {
                if (!inputs.statusPageId) throw new Error('statusPageId is required.');
                const body: any = {};
                if (inputs.companyName) body.company_name = inputs.companyName;
                if (inputs.subdomain) body.subdomain = inputs.subdomain;
                if (inputs.timezone) body.timezone = inputs.timezone;
                if (inputs.subscribable !== undefined) body.subscribable = inputs.subscribable;
                const data = await bu('PATCH', `/status-pages/${inputs.statusPageId}`, body);
                return { output: data };
            }

            case 'listHeartbeats': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await bu('GET', `/heartbeats?${params.toString()}`);
                return { output: data };
            }

            case 'createHeartbeat': {
                if (!inputs.name) throw new Error('name is required.');
                const body: any = { name: inputs.name };
                if (inputs.period) body.period = inputs.period;
                if (inputs.grace) body.grace = inputs.grace;
                if (inputs.email !== undefined) body.email = inputs.email;
                if (inputs.paused !== undefined) body.paused = inputs.paused;
                const data = await bu('POST', '/heartbeats', body);
                return { output: data };
            }

            default:
                throw new Error(`Unknown BetterUptime action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[BetterUptime] Error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
