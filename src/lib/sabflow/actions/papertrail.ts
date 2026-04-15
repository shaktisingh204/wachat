'use server';

const PAPERTRAIL_BASE = 'https://papertrailapp.com/api/v1';

async function papertrailFetch(
    apiToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any,
) {
    logger?.log(`[Papertrail] ${method} ${path}`);
    const url = `${PAPERTRAIL_BASE}${path}`;
    const headers: Record<string, string> = {
        'X-Papertrail-Token': apiToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        const msg = data?.message || data?.error || `Papertrail API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executePapertrailAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');
        const pf = (method: string, path: string, body?: any) =>
            papertrailFetch(apiToken, method, path, body, logger);

        switch (actionName) {
            case 'searchEvents': {
                const q = String(inputs.q ?? '').trim();
                const params = new URLSearchParams();
                if (q) params.set('q', q);
                if (inputs.minId) params.set('min_id', String(inputs.minId));
                if (inputs.maxId) params.set('max_id', String(inputs.maxId));
                if (inputs.minTime) params.set('min_time', String(inputs.minTime));
                if (inputs.maxTime) params.set('max_time', String(inputs.maxTime));
                if (inputs.systemId) params.set('system_id', String(inputs.systemId));
                if (inputs.groupId) params.set('group_id', String(inputs.groupId));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await pf('GET', `/events/search.json${qs}`);
                return { output: { minId: data.min_id, maxId: data.max_id, events: data.events ?? [] } };
            }

            case 'listSystems': {
                const data = await pf('GET', '/systems.json');
                const systems = (Array.isArray(data) ? data : []).map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    hostname: s.hostname,
                    syslogHostname: s.syslog_hostname,
                    syslogPort: s.syslog_port,
                }));
                return { output: { systems } };
            }

            case 'getSystem': {
                const systemId = String(inputs.systemId ?? '').trim();
                if (!systemId) throw new Error('systemId is required.');
                const data = await pf('GET', `/systems/${systemId}.json`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        hostname: data.hostname,
                        syslogHostname: data.syslog_hostname,
                        syslogPort: data.syslog_port,
                    },
                };
            }

            case 'createSystem': {
                const name = String(inputs.name ?? '').trim();
                const hostname = String(inputs.hostname ?? '').trim();
                if (!name || !hostname) throw new Error('name and hostname are required.');
                const body: any = { system: { name, hostname } };
                if (inputs.ipAddress) body.system.ip_address = String(inputs.ipAddress).trim();
                if (inputs.destinationPort) body.system.destination_port = Number(inputs.destinationPort);
                if (inputs.destinationId) body.system.destination_id = Number(inputs.destinationId);
                const data = await pf('POST', '/systems.json', body);
                return { output: { id: data.id, name: data.name, syslogHostname: data.syslog_hostname, syslogPort: data.syslog_port } };
            }

            case 'updateSystem': {
                const systemId = String(inputs.systemId ?? '').trim();
                if (!systemId) throw new Error('systemId is required.');
                const systemData = inputs.system && typeof inputs.system === 'object' ? inputs.system : {};
                const data = await pf('PUT', `/systems/${systemId}.json`, { system: systemData });
                return { output: { id: data.id, name: data.name } };
            }

            case 'deleteSystem': {
                const systemId = String(inputs.systemId ?? '').trim();
                if (!systemId) throw new Error('systemId is required.');
                await pf('DELETE', `/systems/${systemId}.json`);
                return { output: { deleted: true, systemId } };
            }

            case 'listGroups': {
                const data = await pf('GET', '/groups.json');
                const groups = (Array.isArray(data) ? data : []).map((g: any) => ({
                    id: g.id,
                    name: g.name,
                    systemWildcard: g.system_wildcard,
                }));
                return { output: { groups } };
            }

            case 'getGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const data = await pf('GET', `/groups/${groupId}.json`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        systemWildcard: data.system_wildcard,
                        systems: data.systems ?? [],
                    },
                };
            }

            case 'createGroup': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { group: { name } };
                if (inputs.systemWildcard) body.group.system_wildcard = String(inputs.systemWildcard).trim();
                const data = await pf('POST', '/groups.json', body);
                return { output: { id: data.id, name: data.name } };
            }

            case 'updateGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const groupData = inputs.group && typeof inputs.group === 'object' ? inputs.group : {};
                const data = await pf('PUT', `/groups/${groupId}.json`, { group: groupData });
                return { output: { id: data.id, name: data.name } };
            }

            case 'deleteGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                await pf('DELETE', `/groups/${groupId}.json`);
                return { output: { deleted: true, groupId } };
            }

            case 'listDestinations': {
                const data = await pf('GET', '/destinations.json');
                const destinations = (Array.isArray(data) ? data : []).map((d: any) => ({
                    id: d.id,
                    description: d.description,
                    syslogHostname: d.syslog_hostname,
                    syslogPort: d.syslog_port,
                }));
                return { output: { destinations } };
            }

            case 'getDestination': {
                const destinationId = String(inputs.destinationId ?? '').trim();
                if (!destinationId) throw new Error('destinationId is required.');
                const data = await pf('GET', `/destinations/${destinationId}.json`);
                return {
                    output: {
                        id: data.id,
                        description: data.description,
                        syslogHostname: data.syslog_hostname,
                        syslogPort: data.syslog_port,
                    },
                };
            }

            case 'listSavedSearches': {
                const data = await pf('GET', '/searches.json');
                const searches = (Array.isArray(data) ? data : []).map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    query: s.query,
                }));
                return { output: { searches } };
            }

            case 'createSavedSearch': {
                const name = String(inputs.name ?? '').trim();
                const query = String(inputs.query ?? '').trim();
                if (!name || !query) throw new Error('name and query are required.');
                const body: any = { search: { name, query } };
                if (inputs.groupId) body.search.group_id = Number(inputs.groupId);
                const data = await pf('POST', '/searches.json', body);
                return { output: { id: data.id, name: data.name, query: data.query } };
            }

            default:
                return { error: `Papertrail action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Papertrail action failed.' };
    }
}
