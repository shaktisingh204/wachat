'use server';

export async function executeNetlifyEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.netlify.com/api/v1';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${inputs.accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listSites': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.filter) params.set('filter', inputs.filter);
                const res = await fetch(`${baseUrl}/sites?${params.toString()}`, { headers });
                if (!res.ok) return { error: `Failed to list sites: ${res.statusText}` };
                const data = await res.json();
                return { output: { sites: data } };
            }

            case 'getSite': {
                const res = await fetch(`${baseUrl}/sites/${inputs.siteId}`, { headers });
                if (!res.ok) return { error: `Failed to get site: ${res.statusText}` };
                const data = await res.json();
                return { output: { site: data } };
            }

            case 'createSite': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.customDomain) body.custom_domain = inputs.customDomain;
                if (inputs.password) body.password = inputs.password;
                if (inputs.forceSsl !== undefined) body.force_ssl = inputs.forceSsl;
                const res = await fetch(`${baseUrl}/sites`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create site: ${res.statusText}` };
                const data = await res.json();
                return { output: { site: data } };
            }

            case 'updateSite': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.customDomain) body.custom_domain = inputs.customDomain;
                if (inputs.forceSsl !== undefined) body.force_ssl = inputs.forceSsl;
                if (inputs.buildSettings) body.build_settings = inputs.buildSettings;
                const res = await fetch(`${baseUrl}/sites/${inputs.siteId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to update site: ${res.statusText}` };
                const data = await res.json();
                return { output: { site: data } };
            }

            case 'deleteSite': {
                const res = await fetch(`${baseUrl}/sites/${inputs.siteId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `Failed to delete site: ${res.statusText}` };
                return { output: { deleted: true } };
            }

            case 'listDeploys': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/sites/${inputs.siteId}/deploys?${params.toString()}`, { headers });
                if (!res.ok) return { error: `Failed to list deploys: ${res.statusText}` };
                const data = await res.json();
                return { output: { deploys: data } };
            }

            case 'getDeploy': {
                const res = await fetch(`${baseUrl}/deploys/${inputs.deployId}`, { headers });
                if (!res.ok) return { error: `Failed to get deploy: ${res.statusText}` };
                const data = await res.json();
                return { output: { deploy: data } };
            }

            case 'createDeploy': {
                const body: any = {};
                if (inputs.branch) body.branch = inputs.branch;
                if (inputs.clearCache !== undefined) body.clear_cache = inputs.clearCache;
                const res = await fetch(`${baseUrl}/sites/${inputs.siteId}/deploys`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create deploy: ${res.statusText}` };
                const data = await res.json();
                return { output: { deploy: data } };
            }

            case 'cancelDeploy': {
                const res = await fetch(`${baseUrl}/deploys/${inputs.deployId}/cancel`, {
                    method: 'POST',
                    headers,
                });
                if (!res.ok) return { error: `Failed to cancel deploy: ${res.statusText}` };
                const data = await res.json();
                return { output: { deploy: data } };
            }

            case 'restoreDeploy': {
                const res = await fetch(`${baseUrl}/sites/${inputs.siteId}/deploys/${inputs.deployId}/restore`, {
                    method: 'POST',
                    headers,
                });
                if (!res.ok) return { error: `Failed to restore deploy: ${res.statusText}` };
                const data = await res.json();
                return { output: { deploy: data } };
            }

            case 'listForms': {
                const res = await fetch(`${baseUrl}/sites/${inputs.siteId}/forms`, { headers });
                if (!res.ok) return { error: `Failed to list forms: ${res.statusText}` };
                const data = await res.json();
                return { output: { forms: data } };
            }

            case 'getForm': {
                const res = await fetch(`${baseUrl}/forms/${inputs.formId}`, { headers });
                if (!res.ok) return { error: `Failed to get form: ${res.statusText}` };
                const data = await res.json();
                return { output: { form: data } };
            }

            case 'listSubmissions': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const endpoint = inputs.formId
                    ? `${baseUrl}/forms/${inputs.formId}/submissions`
                    : `${baseUrl}/sites/${inputs.siteId}/submissions`;
                const res = await fetch(`${endpoint}?${params.toString()}`, { headers });
                if (!res.ok) return { error: `Failed to list submissions: ${res.statusText}` };
                const data = await res.json();
                return { output: { submissions: data } };
            }

            case 'listDnsZones': {
                const res = await fetch(`${baseUrl}/dns_zones`, { headers });
                if (!res.ok) return { error: `Failed to list DNS zones: ${res.statusText}` };
                const data = await res.json();
                return { output: { dnsZones: data } };
            }

            case 'createDnsZone': {
                const body: any = { name: inputs.name };
                if (inputs.siteId) body.site_id = inputs.siteId;
                const res = await fetch(`${baseUrl}/dns_zones`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create DNS zone: ${res.statusText}` };
                const data = await res.json();
                return { output: { dnsZone: data } };
            }

            default:
                return { error: `Unknown Netlify Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Netlify Enhanced action error: ${err.message}`);
        return { error: err.message || 'Netlify Enhanced action failed' };
    }
}
