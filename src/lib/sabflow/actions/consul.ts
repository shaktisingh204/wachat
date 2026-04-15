'use server';

export async function executeConsulAction(actionName: string, inputs: any, user: any, logger: any) {
    const token = inputs.token;
    const baseUrl = (inputs.consulAddr ?? 'http://localhost:8500').replace(/\/$/, '');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) headers['X-Consul-Token'] = token;

    try {
        switch (actionName) {
            case 'listServices': {
                const { dc } = inputs;
                const query = dc ? `?dc=${dc}` : '';
                const res = await fetch(`${baseUrl}/v1/catalog/services${query}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { services: data } };
            }

            case 'getService': {
                const { serviceName, dc } = inputs;
                const query = dc ? `?dc=${dc}` : '';
                const res = await fetch(`${baseUrl}/v1/catalog/service/${serviceName}${query}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { service: data } };
            }

            case 'registerService': {
                const { id, name, address, port, tags, meta, check } = inputs;
                const body: any = { ID: id, Name: name, Address: address, Port: port };
                if (tags) body.Tags = tags;
                if (meta) body.Meta = meta;
                if (check) body.Check = check;
                const res = await fetch(`${baseUrl}/v1/agent/service/register`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (res.status === 200) return { output: { registered: true, serviceId: id } };
                const text = await res.text();
                return { error: text || `HTTP ${res.status}` };
            }

            case 'deregisterService': {
                const { serviceId } = inputs;
                const res = await fetch(`${baseUrl}/v1/agent/service/deregister/${serviceId}`, { method: 'PUT', headers });
                if (res.status === 200) return { output: { deregistered: true, serviceId } };
                const text = await res.text();
                return { error: text || `HTTP ${res.status}` };
            }

            case 'healthService': {
                const { serviceName, passing, dc } = inputs;
                const params = new URLSearchParams();
                if (passing) params.set('passing', '1');
                if (dc) params.set('dc', dc);
                const query = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/v1/health/service/${serviceName}${query}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { healthChecks: data } };
            }

            case 'listNodes': {
                const { dc } = inputs;
                const query = dc ? `?dc=${dc}` : '';
                const res = await fetch(`${baseUrl}/v1/catalog/nodes${query}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { nodes: data } };
            }

            case 'getNode': {
                const { nodeName, dc } = inputs;
                const query = dc ? `?dc=${dc}` : '';
                const res = await fetch(`${baseUrl}/v1/catalog/node/${nodeName}${query}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { node: data } };
            }

            case 'listDatacenters': {
                const res = await fetch(`${baseUrl}/v1/catalog/datacenters`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { datacenters: data } };
            }

            case 'getKV': {
                const { key } = inputs;
                const res = await fetch(`${baseUrl}/v1/kv/${key}`, { headers });
                if (res.status === 404) return { error: `Key not found: ${key}` };
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                const entries = Array.isArray(data) ? data : [data];
                const decoded = entries.map((e: any) => ({
                    ...e,
                    Value: e.Value ? Buffer.from(e.Value, 'base64').toString('utf-8') : null,
                }));
                return { output: { entry: decoded[0], entries: decoded } };
            }

            case 'putKV': {
                const { key, value } = inputs;
                const res = await fetch(`${baseUrl}/v1/kv/${key}`, {
                    method: 'PUT',
                    headers: { ...headers, 'Content-Type': 'text/plain' },
                    body: String(value),
                });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { success: data, key } };
            }

            case 'deleteKV': {
                const { key, recurse } = inputs;
                const query = recurse ? '?recurse' : '';
                const res = await fetch(`${baseUrl}/v1/kv/${key}${query}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { deleted: data, key } };
            }

            case 'listKV': {
                const { prefix } = inputs;
                const res = await fetch(`${baseUrl}/v1/kv/${prefix ?? ''}?keys`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { keys: data } };
            }

            case 'createSession': {
                const { name, ttl, behavior = 'release', lockDelay } = inputs;
                const body: any = { Name: name, Behavior: behavior };
                if (ttl) body.TTL = ttl;
                if (lockDelay) body.LockDelay = lockDelay;
                const res = await fetch(`${baseUrl}/v1/session/create`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { sessionId: data.ID } };
            }

            case 'destroySession': {
                const { sessionId } = inputs;
                const res = await fetch(`${baseUrl}/v1/session/destroy/${sessionId}`, { method: 'PUT', headers });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { destroyed: data, sessionId } };
            }

            case 'acquireLock': {
                const { key, sessionId, value } = inputs;
                const res = await fetch(`${baseUrl}/v1/kv/${key}?acquire=${sessionId}`, {
                    method: 'PUT',
                    headers: { ...headers, 'Content-Type': 'text/plain' },
                    body: String(value ?? ''),
                });
                const data = await res.json();
                if (!res.ok) return { error: typeof data === 'string' ? data : `HTTP ${res.status}` };
                return { output: { acquired: data, key, sessionId } };
            }

            default:
                return { error: `Unknown Consul action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Consul action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in Consul action' };
    }
}
