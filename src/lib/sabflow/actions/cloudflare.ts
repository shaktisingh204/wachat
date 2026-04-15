
'use server';

const CF_BASE = 'https://api.cloudflare.com/client/v4';

async function cfFetch(inputs: any, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Cloudflare] ${method} ${path}`);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (inputs.apiToken) {
        headers['Authorization'] = `Bearer ${inputs.apiToken}`;
    } else {
        headers['X-Auth-Key'] = inputs.apiKey ?? '';
        headers['X-Auth-Email'] = inputs.email ?? '';
    }
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${CF_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok || data.success === false) {
        const msg = data.errors?.[0]?.message || `Cloudflare API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeCloudflareAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const cf = (method: string, path: string, body?: any) => cfFetch(inputs, method, path, body, logger);

        switch (actionName) {
            case 'listZones': {
                const data = await cf('GET', '/zones');
                return { output: { zones: data.result } };
            }

            case 'getZone': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                if (!zoneId) throw new Error('zoneId is required.');
                const data = await cf('GET', `/zones/${zoneId}`);
                return { output: data.result };
            }

            case 'listDnsRecords': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                if (!zoneId) throw new Error('zoneId is required.');
                const data = await cf('GET', `/zones/${zoneId}/dns_records`);
                return { output: { records: data.result } };
            }

            case 'getDnsRecord': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!zoneId || !recordId) throw new Error('zoneId and recordId are required.');
                const data = await cf('GET', `/zones/${zoneId}/dns_records/${recordId}`);
                return { output: data.result };
            }

            case 'createDnsRecord': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                if (!zoneId) throw new Error('zoneId is required.');
                const body: any = {
                    type: inputs.type,
                    name: inputs.name,
                    content: inputs.content,
                };
                if (inputs.ttl !== undefined) body.ttl = Number(inputs.ttl);
                if (inputs.proxied !== undefined) body.proxied = inputs.proxied === true || inputs.proxied === 'true';
                const data = await cf('POST', `/zones/${zoneId}/dns_records`, body);
                return { output: data.result };
            }

            case 'updateDnsRecord': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!zoneId || !recordId) throw new Error('zoneId and recordId are required.');
                const body: any = {};
                if (inputs.type) body.type = inputs.type;
                if (inputs.name) body.name = inputs.name;
                if (inputs.content) body.content = inputs.content;
                if (inputs.ttl !== undefined) body.ttl = Number(inputs.ttl);
                if (inputs.proxied !== undefined) body.proxied = inputs.proxied === true || inputs.proxied === 'true';
                const data = await cf('PATCH', `/zones/${zoneId}/dns_records/${recordId}`, body);
                return { output: data.result };
            }

            case 'deleteDnsRecord': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!zoneId || !recordId) throw new Error('zoneId and recordId are required.');
                const data = await cf('DELETE', `/zones/${zoneId}/dns_records/${recordId}`);
                return { output: { id: data.result?.id, deleted: true } };
            }

            case 'purgeCache': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                if (!zoneId) throw new Error('zoneId is required.');
                const body: any = {};
                if (inputs.purgeEverything === true || inputs.purgeEverything === 'true') {
                    body.purge_everything = true;
                } else if (inputs.files) {
                    body.files = Array.isArray(inputs.files) ? inputs.files : [inputs.files];
                }
                const data = await cf('POST', `/zones/${zoneId}/purge_cache`, body);
                return { output: { id: data.result?.id, success: true } };
            }

            case 'listPageRules': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                if (!zoneId) throw new Error('zoneId is required.');
                const data = await cf('GET', `/zones/${zoneId}/pagerules`);
                return { output: { rules: data.result } };
            }

            case 'createPageRule': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                if (!zoneId) throw new Error('zoneId is required.');
                const body: any = {
                    targets: inputs.targets,
                    actions: inputs.actions,
                };
                if (inputs.status) body.status = inputs.status;
                if (inputs.priority !== undefined) body.priority = Number(inputs.priority);
                const data = await cf('POST', `/zones/${zoneId}/pagerules`, body);
                return { output: data.result };
            }

            case 'updatePageRule': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                const ruleId = String(inputs.ruleId ?? '').trim();
                if (!zoneId || !ruleId) throw new Error('zoneId and ruleId are required.');
                const body: any = {};
                if (inputs.targets) body.targets = inputs.targets;
                if (inputs.actions) body.actions = inputs.actions;
                if (inputs.status) body.status = inputs.status;
                if (inputs.priority !== undefined) body.priority = Number(inputs.priority);
                const data = await cf('PATCH', `/zones/${zoneId}/pagerules/${ruleId}`, body);
                return { output: data.result };
            }

            case 'deletePageRule': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                const ruleId = String(inputs.ruleId ?? '').trim();
                if (!zoneId || !ruleId) throw new Error('zoneId and ruleId are required.');
                await cf('DELETE', `/zones/${zoneId}/pagerules/${ruleId}`);
                return { output: { deleted: true } };
            }

            case 'listWorkers': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const data = await cf('GET', `/accounts/${accountId}/workers/scripts`);
                return { output: { workers: data.result } };
            }

            case 'deployWorker': {
                const accountId = String(inputs.accountId ?? '').trim();
                const scriptName = String(inputs.scriptName ?? '').trim();
                const script = String(inputs.script ?? '').trim();
                if (!accountId || !scriptName || !script) throw new Error('accountId, scriptName, and script are required.');
                const res = await fetch(`${CF_BASE}/accounts/${accountId}/workers/scripts/${scriptName}`, {
                    method: 'PUT',
                    headers: {
                        ...(inputs.apiToken ? { 'Authorization': `Bearer ${inputs.apiToken}` } : { 'X-Auth-Key': inputs.apiKey ?? '', 'X-Auth-Email': inputs.email ?? '' }),
                        'Content-Type': 'application/javascript',
                    },
                    body: script,
                });
                const data = await res.json();
                if (!res.ok || data.success === false) throw new Error(data.errors?.[0]?.message || `Deploy failed: ${res.status}`);
                return { output: { id: data.result?.id, etag: data.result?.etag } };
            }

            case 'deleteWorker': {
                const accountId = String(inputs.accountId ?? '').trim();
                const scriptName = String(inputs.scriptName ?? '').trim();
                if (!accountId || !scriptName) throw new Error('accountId and scriptName are required.');
                await cf('DELETE', `/accounts/${accountId}/workers/scripts/${scriptName}`);
                return { output: { deleted: true } };
            }

            case 'getAnalytics': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                if (!zoneId) throw new Error('zoneId is required.');
                const since = inputs.since ? `?since=${inputs.since}` : '';
                const data = await cf('GET', `/zones/${zoneId}/analytics/dashboard${since}`);
                return { output: data.result };
            }

            case 'listFirewallRules': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                if (!zoneId) throw new Error('zoneId is required.');
                const data = await cf('GET', `/zones/${zoneId}/firewall/rules`);
                return { output: { rules: data.result } };
            }

            case 'createFirewallRule': {
                const zoneId = String(inputs.zoneId ?? '').trim();
                if (!zoneId) throw new Error('zoneId is required.');
                const body: any = {
                    filter: inputs.filter,
                    action: inputs.action,
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.priority !== undefined) body.priority = Number(inputs.priority);
                const data = await cf('POST', `/zones/${zoneId}/firewall/rules`, [body]);
                return { output: data.result?.[0] ?? data.result };
            }

            default:
                throw new Error(`Unknown Cloudflare action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Cloudflare] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Cloudflare error' };
    }
}
