'use server';

const BASE_URL = 'https://api.cloudflare.com/client/v4';

export async function executeCloudflareApiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = inputs.apiToken;
        if (!token) return { error: 'Missing apiToken in inputs' };

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listZones': {
                const params = new URLSearchParams();
                if (inputs.name) params.set('name', inputs.name);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${BASE_URL}/zones?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getZone': {
                if (!inputs.zoneId) return { error: 'Missing zoneId' };
                const res = await fetch(`${BASE_URL}/zones/${inputs.zoneId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createZone': {
                if (!inputs.name) return { error: 'Missing zone name' };
                const body: any = { name: inputs.name };
                if (inputs.accountId) body.account = { id: inputs.accountId };
                if (inputs.jumpStart !== undefined) body.jump_start = inputs.jumpStart;
                const res = await fetch(`${BASE_URL}/zones`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteZone': {
                if (!inputs.zoneId) return { error: 'Missing zoneId' };
                const res = await fetch(`${BASE_URL}/zones/${inputs.zoneId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listDNSRecords': {
                if (!inputs.zoneId) return { error: 'Missing zoneId' };
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.name) params.set('name', inputs.name);
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${BASE_URL}/zones/${inputs.zoneId}/dns_records?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getDNSRecord': {
                if (!inputs.zoneId || !inputs.recordId) return { error: 'Missing zoneId or recordId' };
                const res = await fetch(`${BASE_URL}/zones/${inputs.zoneId}/dns_records/${inputs.recordId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createDNSRecord': {
                if (!inputs.zoneId) return { error: 'Missing zoneId' };
                const body: any = {
                    type: inputs.type,
                    name: inputs.name,
                    content: inputs.content,
                };
                if (inputs.ttl !== undefined) body.ttl = inputs.ttl;
                if (inputs.proxied !== undefined) body.proxied = inputs.proxied;
                const res = await fetch(`${BASE_URL}/zones/${inputs.zoneId}/dns_records`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateDNSRecord': {
                if (!inputs.zoneId || !inputs.recordId) return { error: 'Missing zoneId or recordId' };
                const body: any = {};
                if (inputs.type) body.type = inputs.type;
                if (inputs.name) body.name = inputs.name;
                if (inputs.content) body.content = inputs.content;
                if (inputs.ttl !== undefined) body.ttl = inputs.ttl;
                if (inputs.proxied !== undefined) body.proxied = inputs.proxied;
                const res = await fetch(`${BASE_URL}/zones/${inputs.zoneId}/dns_records/${inputs.recordId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteDNSRecord': {
                if (!inputs.zoneId || !inputs.recordId) return { error: 'Missing zoneId or recordId' };
                const res = await fetch(`${BASE_URL}/zones/${inputs.zoneId}/dns_records/${inputs.recordId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'purgeCache': {
                if (!inputs.zoneId) return { error: 'Missing zoneId' };
                const body: any = {};
                if (inputs.purgeEverything) {
                    body.purge_everything = true;
                } else if (inputs.files) {
                    body.files = Array.isArray(inputs.files) ? inputs.files : [inputs.files];
                } else {
                    body.purge_everything = true;
                }
                const res = await fetch(`${BASE_URL}/zones/${inputs.zoneId}/purge_cache`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listWorkers': {
                if (!inputs.accountId) return { error: 'Missing accountId' };
                const res = await fetch(`${BASE_URL}/accounts/${inputs.accountId}/workers/scripts`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'deployWorker': {
                if (!inputs.accountId || !inputs.scriptName) return { error: 'Missing accountId or scriptName' };
                const res = await fetch(`${BASE_URL}/accounts/${inputs.accountId}/workers/scripts/${inputs.scriptName}`, {
                    method: 'PUT',
                    headers: { ...headers, 'Content-Type': 'application/javascript' },
                    body: inputs.scriptContent || '',
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteWorker': {
                if (!inputs.accountId || !inputs.scriptName) return { error: 'Missing accountId or scriptName' };
                const res = await fetch(`${BASE_URL}/accounts/${inputs.accountId}/workers/scripts/${inputs.scriptName}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listKVNamespaces': {
                if (!inputs.accountId) return { error: 'Missing accountId' };
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${BASE_URL}/accounts/${inputs.accountId}/storage/kv/namespaces?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createKVNamespace': {
                if (!inputs.accountId || !inputs.title) return { error: 'Missing accountId or title' };
                const res = await fetch(`${BASE_URL}/accounts/${inputs.accountId}/storage/kv/namespaces`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ title: inputs.title }),
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown Cloudflare API action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeCloudflareApiAction error: ${err.message}`);
        return { error: err.message || 'Unknown error in Cloudflare API action' };
    }
}
