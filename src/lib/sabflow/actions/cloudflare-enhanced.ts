'use server';

export async function executeCloudflareEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.cloudflare.com/client/v4';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${inputs.apiToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listZones': {
                const params = new URLSearchParams();
                if (inputs.name) params.set('name', inputs.name);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/zones?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list zones' };
                return { output: { zones: data.result, resultInfo: data.result_info } };
            }

            case 'getZone': {
                const res = await fetch(`${baseUrl}/zones/${inputs.zoneId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get zone' };
                return { output: { zone: data.result } };
            }

            case 'listDnsRecords': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.name) params.set('name', inputs.name);
                if (inputs.content) params.set('content', inputs.content);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/zones/${inputs.zoneId}/dns_records?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list DNS records' };
                return { output: { records: data.result, resultInfo: data.result_info } };
            }

            case 'getDnsRecord': {
                const res = await fetch(`${baseUrl}/zones/${inputs.zoneId}/dns_records/${inputs.recordId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get DNS record' };
                return { output: { record: data.result } };
            }

            case 'createDnsRecord': {
                const body: any = {
                    type: inputs.type,
                    name: inputs.name,
                    content: inputs.content,
                };
                if (inputs.ttl !== undefined) body.ttl = inputs.ttl;
                if (inputs.proxied !== undefined) body.proxied = inputs.proxied;
                if (inputs.priority !== undefined) body.priority = inputs.priority;
                const res = await fetch(`${baseUrl}/zones/${inputs.zoneId}/dns_records`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create DNS record' };
                return { output: { record: data.result } };
            }

            case 'updateDnsRecord': {
                const body: any = {};
                if (inputs.type) body.type = inputs.type;
                if (inputs.name) body.name = inputs.name;
                if (inputs.content) body.content = inputs.content;
                if (inputs.ttl !== undefined) body.ttl = inputs.ttl;
                if (inputs.proxied !== undefined) body.proxied = inputs.proxied;
                const res = await fetch(`${baseUrl}/zones/${inputs.zoneId}/dns_records/${inputs.recordId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to update DNS record' };
                return { output: { record: data.result } };
            }

            case 'deleteDnsRecord': {
                const res = await fetch(`${baseUrl}/zones/${inputs.zoneId}/dns_records/${inputs.recordId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to delete DNS record' };
                return { output: { id: data.result?.id, deleted: true } };
            }

            case 'purgeCache': {
                const body: any = {};
                if (inputs.purgeEverything) {
                    body.purge_everything = true;
                } else if (inputs.files) {
                    body.files = inputs.files;
                } else if (inputs.tags) {
                    body.tags = inputs.tags;
                } else if (inputs.hosts) {
                    body.hosts = inputs.hosts;
                }
                const res = await fetch(`${baseUrl}/zones/${inputs.zoneId}/purge_cache`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to purge cache' };
                return { output: { id: data.result?.id, purged: true } };
            }

            case 'listWorkers': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/workers/scripts`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list workers' };
                return { output: { workers: data.result } };
            }

            case 'getWorker': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/workers/scripts/${inputs.scriptName}`, { headers });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.errors?.[0]?.message || 'Failed to get worker' };
                }
                const script = await res.text();
                return { output: { scriptName: inputs.scriptName, script } };
            }

            case 'deployWorker': {
                const workerHeaders = { ...headers };
                delete workerHeaders['Content-Type'];
                workerHeaders['Content-Type'] = 'application/javascript';
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/workers/scripts/${inputs.scriptName}`, {
                    method: 'PUT',
                    headers: workerHeaders,
                    body: inputs.script,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to deploy worker' };
                return { output: { worker: data.result, deployed: true } };
            }

            case 'deleteWorker': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/workers/scripts/${inputs.scriptName}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to delete worker' };
                return { output: { deleted: true } };
            }

            case 'listPages': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/pages/projects`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list Pages projects' };
                return { output: { projects: data.result } };
            }

            case 'getPageProject': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/pages/projects/${inputs.projectName}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get Pages project' };
                return { output: { project: data.result } };
            }

            case 'deployPages': {
                const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/pages/projects/${inputs.projectName}/deployments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ branch: inputs.branch || 'main' }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to deploy Pages project' };
                return { output: { deployment: data.result } };
            }

            default:
                return { error: `Unknown Cloudflare Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Cloudflare Enhanced action error: ${err.message}`);
        return { error: err.message || 'Cloudflare Enhanced action failed' };
    }
}
