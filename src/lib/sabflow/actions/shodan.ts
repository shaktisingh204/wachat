'use server';

export async function executeShodanAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.shodan.io';
    const key = inputs.apiKey;

    try {
        switch (actionName) {
            case 'searchHosts': {
                const params = new URLSearchParams({ key, query: inputs.query, ...(inputs.facets ? { facets: inputs.facets } : {}), ...(inputs.page ? { page: String(inputs.page) } : {}), ...(inputs.minify !== undefined ? { minify: String(inputs.minify) } : {}) });
                const res = await fetch(`${BASE}/shodan/host/search?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'getHost': {
                const ip = inputs.ip || inputs.ipAddress;
                const params = new URLSearchParams({ key, ...(inputs.history !== undefined ? { history: String(inputs.history) } : {}), ...(inputs.minify !== undefined ? { minify: String(inputs.minify) } : {}) });
                const res = await fetch(`${BASE}/shodan/host/${ip}?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'searchQuery': {
                const params = new URLSearchParams({ key, ...(inputs.page ? { page: String(inputs.page) } : {}), ...(inputs.sort ? { sort: inputs.sort } : {}), ...(inputs.order ? { order: inputs.order } : {}), ...(inputs.query ? { query: inputs.query } : {}) });
                const res = await fetch(`${BASE}/shodan/query?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'searchTokens': {
                const params = new URLSearchParams({ key, query: inputs.query });
                const res = await fetch(`${BASE}/shodan/host/search/tokens?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'getMyIp': {
                const params = new URLSearchParams({ key });
                const res = await fetch(`${BASE}/tools/myip?${params}`);
                const data = await res.json();
                return { output: { ip: data } };
            }
            case 'getApiInfo': {
                const params = new URLSearchParams({ key });
                const res = await fetch(`${BASE}/api-info?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'listFacets': {
                const params = new URLSearchParams({ key });
                const res = await fetch(`${BASE}/shodan/host/search/facets?${params}`);
                const data = await res.json();
                return { output: { facets: data } };
            }
            case 'listFilters': {
                const params = new URLSearchParams({ key });
                const res = await fetch(`${BASE}/shodan/host/search/filters?${params}`);
                const data = await res.json();
                return { output: { filters: data } };
            }
            case 'getResolve': {
                const params = new URLSearchParams({ key, hostnames: inputs.hostnames });
                const res = await fetch(`${BASE}/dns/resolve?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'lookupReverse': {
                const params = new URLSearchParams({ key, ips: inputs.ips });
                const res = await fetch(`${BASE}/dns/reverse?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'listTags': {
                const params = new URLSearchParams({ key, ...(inputs.size ? { size: String(inputs.size) } : {}) });
                const res = await fetch(`${BASE}/shodan/query/tags?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'lookupDNS': {
                const params = new URLSearchParams({ key, hostnames: inputs.hostnames });
                const res = await fetch(`${BASE}/dns/resolve?${params}`);
                const data = await res.json();
                return { output: data };
            }
            case 'getAlerts': {
                const params = new URLSearchParams({ key });
                const res = await fetch(`${BASE}/shodan/alert/info?${params}`);
                const data = await res.json();
                return { output: { alerts: data } };
            }
            case 'createAlert': {
                const params = new URLSearchParams({ key });
                const res = await fetch(`${BASE}/shodan/alert?${params}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: inputs.name, filters: { ip: inputs.ip || inputs.ipAddresses }, expires: inputs.expires || 0 }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteAlert': {
                const params = new URLSearchParams({ key });
                const res = await fetch(`${BASE}/shodan/alert/${inputs.alertId}?${params}`, { method: 'DELETE' });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown Shodan action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Shodan action error: ${err.message}`);
        return { error: err.message || 'Shodan action failed' };
    }
}
