'use server';

export async function executeFastlyAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.fastly.com';
    const headers: Record<string, string> = {
        'Fastly-Key': inputs.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listServices': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.direction) params.set('direction', inputs.direction);
                const res = await fetch(`${baseUrl}/service?${params.toString()}`, { headers });
                if (!res.ok) return { error: `Failed to list services: ${res.statusText}` };
                const data = await res.json();
                return { output: { services: data } };
            }

            case 'getService': {
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}`, { headers });
                if (!res.ok) return { error: `Failed to get service: ${res.statusText}` };
                const data = await res.json();
                return { output: { service: data } };
            }

            case 'createService': {
                const body: any = { name: inputs.name, type: inputs.type || 'vcl' };
                if (inputs.comment) body.comment = inputs.comment;
                const res = await fetch(`${baseUrl}/service`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create service: ${res.statusText}` };
                const data = await res.json();
                return { output: { service: data } };
            }

            case 'updateService': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.comment) body.comment = inputs.comment;
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to update service: ${res.statusText}` };
                const data = await res.json();
                return { output: { service: data } };
            }

            case 'deleteService': {
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `Failed to delete service: ${res.statusText}` };
                const data = await res.json();
                return { output: { status: data.status, deleted: true } };
            }

            case 'listVersions': {
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}/version`, { headers });
                if (!res.ok) return { error: `Failed to list versions: ${res.statusText}` };
                const data = await res.json();
                return { output: { versions: data } };
            }

            case 'getVersion': {
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}/version/${inputs.versionNumber}`, { headers });
                if (!res.ok) return { error: `Failed to get version: ${res.statusText}` };
                const data = await res.json();
                return { output: { version: data } };
            }

            case 'cloneVersion': {
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}/version/${inputs.versionNumber}/clone`, {
                    method: 'PUT',
                    headers,
                });
                if (!res.ok) return { error: `Failed to clone version: ${res.statusText}` };
                const data = await res.json();
                return { output: { version: data } };
            }

            case 'activateVersion': {
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}/version/${inputs.versionNumber}/activate`, {
                    method: 'PUT',
                    headers,
                });
                if (!res.ok) return { error: `Failed to activate version: ${res.statusText}` };
                const data = await res.json();
                return { output: { version: data } };
            }

            case 'deactivateVersion': {
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}/version/${inputs.versionNumber}/deactivate`, {
                    method: 'PUT',
                    headers,
                });
                if (!res.ok) return { error: `Failed to deactivate version: ${res.statusText}` };
                const data = await res.json();
                return { output: { version: data } };
            }

            case 'listDomains': {
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}/version/${inputs.versionNumber}/domain`, { headers });
                if (!res.ok) return { error: `Failed to list domains: ${res.statusText}` };
                const data = await res.json();
                return { output: { domains: data } };
            }

            case 'createDomain': {
                const body: any = { name: inputs.name };
                if (inputs.comment) body.comment = inputs.comment;
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}/version/${inputs.versionNumber}/domain`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create domain: ${res.statusText}` };
                const data = await res.json();
                return { output: { domain: data } };
            }

            case 'listBackends': {
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}/version/${inputs.versionNumber}/backend`, { headers });
                if (!res.ok) return { error: `Failed to list backends: ${res.statusText}` };
                const data = await res.json();
                return { output: { backends: data } };
            }

            case 'createBackend': {
                const body: any = {
                    name: inputs.name,
                    address: inputs.address,
                    port: inputs.port || 80,
                };
                if (inputs.sslCertHostname) body.ssl_cert_hostname = inputs.sslCertHostname;
                if (inputs.useSsl !== undefined) body.use_ssl = inputs.useSsl;
                if (inputs.weight !== undefined) body.weight = inputs.weight;
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}/version/${inputs.versionNumber}/backend`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create backend: ${res.statusText}` };
                const data = await res.json();
                return { output: { backend: data } };
            }

            case 'purgeAllCache': {
                const purgeHeaders = { ...headers, 'Fastly-Soft-Purge': inputs.softPurge ? '1' : '0' };
                const res = await fetch(`${baseUrl}/service/${inputs.serviceId}/purge_all`, {
                    method: 'POST',
                    headers: purgeHeaders,
                });
                if (!res.ok) return { error: `Failed to purge all cache: ${res.statusText}` };
                const data = await res.json();
                return { output: { status: data.status, purged: true } };
            }

            default:
                return { error: `Unknown Fastly action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Fastly action error: ${err.message}`);
        return { error: err.message || 'Fastly action failed' };
    }
}
