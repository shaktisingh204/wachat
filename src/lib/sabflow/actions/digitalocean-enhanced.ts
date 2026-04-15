'use server';

const DO_BASE = 'https://api.digitalocean.com/v2';

export async function executeDigitalOceanEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        async function doFetch(method: string, path: string, body?: any): Promise<any> {
            logger?.log(`[DigitalOcean] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${DO_BASE}${path}`, options);
            if (res.status === 204) return { success: true };
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.message || `DigitalOcean API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listDroplets': {
                const page = Number(inputs.page ?? 1);
                const perPage = Number(inputs.perPage ?? 25);
                const tag = inputs.tag ? `&tag_name=${encodeURIComponent(String(inputs.tag))}` : '';
                const data = await doFetch('GET', `/droplets?page=${page}&per_page=${perPage}${tag}`);
                return { output: { droplets: data.droplets ?? [], count: data.meta?.total ?? (data.droplets?.length ?? 0) } };
            }

            case 'getDroplet': {
                const dropletId = String(inputs.dropletId ?? '').trim();
                if (!dropletId) throw new Error('dropletId is required.');
                const data = await doFetch('GET', `/droplets/${dropletId}`);
                const d = data.droplet ?? {};
                return { output: { id: d.id, name: d.name, status: d.status, region: d.region?.slug, size: d.size_slug, image: d.image?.name ?? '' } };
            }

            case 'createDroplet': {
                const name = String(inputs.name ?? '').trim();
                const region = String(inputs.region ?? '').trim();
                const size = String(inputs.size ?? '').trim();
                const image = String(inputs.image ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!region) throw new Error('region is required.');
                if (!size) throw new Error('size is required.');
                if (!image) throw new Error('image is required.');
                const body: any = { name, region, size, image };
                if (inputs.sshKeys) body.ssh_keys = inputs.sshKeys;
                if (inputs.tags) body.tags = inputs.tags;
                if (inputs.userData) body.user_data = String(inputs.userData);
                const data = await doFetch('POST', '/droplets', body);
                const d = data.droplet ?? {};
                return { output: { id: d.id, name: d.name, status: d.status } };
            }

            case 'deleteDroplet': {
                const dropletId = String(inputs.dropletId ?? '').trim();
                if (!dropletId) throw new Error('dropletId is required.');
                await doFetch('DELETE', `/droplets/${dropletId}`);
                return { output: { deleted: true, dropletId } };
            }

            case 'listDomains': {
                const page = Number(inputs.page ?? 1);
                const perPage = Number(inputs.perPage ?? 25);
                const data = await doFetch('GET', `/domains?page=${page}&per_page=${perPage}`);
                return { output: { domains: data.domains ?? [], count: data.meta?.total ?? (data.domains?.length ?? 0) } };
            }

            case 'getDomain': {
                const domainName = String(inputs.domainName ?? '').trim();
                if (!domainName) throw new Error('domainName is required.');
                const data = await doFetch('GET', `/domains/${domainName}`);
                const dom = data.domain ?? {};
                return { output: { name: dom.name, ttl: dom.ttl, zoneFile: dom.zone_file ?? '' } };
            }

            case 'createDomain': {
                const domainName = String(inputs.domainName ?? '').trim();
                if (!domainName) throw new Error('domainName is required.');
                const ipAddress = String(inputs.ipAddress ?? '').trim();
                const body: any = { name: domainName };
                if (ipAddress) body.ip_address = ipAddress;
                const data = await doFetch('POST', '/domains', body);
                const dom = data.domain ?? {};
                return { output: { name: dom.name, ttl: dom.ttl } };
            }

            case 'deleteDomain': {
                const domainName = String(inputs.domainName ?? '').trim();
                if (!domainName) throw new Error('domainName is required.');
                await doFetch('DELETE', `/domains/${domainName}`);
                return { output: { deleted: true, domainName } };
            }

            case 'listSpaces': {
                // Spaces use the Spaces API (S3-compatible) — list buckets via DO API
                const data = await doFetch('GET', '/spaces');
                const spaces = data?.spaces ?? (Array.isArray(data) ? data : []);
                return { output: { spaces, count: spaces.length } };
            }

            case 'createSpace': {
                const spaceName = String(inputs.spaceName ?? '').trim();
                const region = String(inputs.region ?? '').trim();
                if (!spaceName) throw new Error('spaceName is required.');
                if (!region) throw new Error('region is required.');
                const data = await doFetch('POST', '/spaces', { name: spaceName, region });
                return { output: { name: data.name ?? spaceName, region: data.region ?? region } };
            }

            case 'listDatabases': {
                const page = Number(inputs.page ?? 1);
                const perPage = Number(inputs.perPage ?? 25);
                const data = await doFetch('GET', `/databases?page=${page}&per_page=${perPage}`);
                return { output: { databases: data.databases ?? [], count: data.databases?.length ?? 0 } };
            }

            case 'getDatabase': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                if (!databaseId) throw new Error('databaseId is required.');
                const data = await doFetch('GET', `/databases/${databaseId}`);
                const db = data.database ?? {};
                return { output: { id: db.id, name: db.name, engine: db.engine, version: db.version, status: db.status, region: db.region } };
            }

            case 'createDatabase': {
                const name = String(inputs.name ?? '').trim();
                const engine = String(inputs.engine ?? 'pg').trim();
                const region = String(inputs.region ?? '').trim();
                const size = String(inputs.size ?? 'db-s-1vcpu-1gb').trim();
                const numNodes = Number(inputs.numNodes ?? 1);
                if (!name) throw new Error('name is required.');
                if (!region) throw new Error('region is required.');
                const body: any = { name, engine, region, size, num_nodes: numNodes };
                if (inputs.version) body.version = String(inputs.version);
                const data = await doFetch('POST', '/databases', body);
                const db = data.database ?? {};
                return { output: { id: db.id, name: db.name, engine: db.engine, status: db.status } };
            }

            case 'listFirewalls': {
                const page = Number(inputs.page ?? 1);
                const perPage = Number(inputs.perPage ?? 25);
                const data = await doFetch('GET', `/firewalls?page=${page}&per_page=${perPage}`);
                return { output: { firewalls: data.firewalls ?? [], count: data.meta?.total ?? (data.firewalls?.length ?? 0) } };
            }

            case 'createFirewall': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const inboundRules = inputs.inboundRules ?? [];
                const outboundRules = inputs.outboundRules ?? [];
                const body: any = { name, inbound_rules: inboundRules, outbound_rules: outboundRules };
                if (inputs.dropletIds) body.droplet_ids = inputs.dropletIds;
                if (inputs.tags) body.tags = inputs.tags;
                const data = await doFetch('POST', '/firewalls', body);
                const fw = data.firewall ?? {};
                return { output: { id: fw.id, name: fw.name, status: fw.status ?? 'waiting' } };
            }

            default:
                return { error: `DigitalOcean Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'DigitalOcean Enhanced action failed.' };
    }
}
