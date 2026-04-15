
'use server';

async function statuspageFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Statuspage] ${method} ${path}`);
    const url = `https://api.statuspage.io/v1${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `OAuth ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error || data?.message || `Statuspage API error: ${res.status}`);
    }
    return data;
}

export async function executeStatuspageAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const sp = (method: string, path: string, body?: any) => statuspageFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listPages': {
                const data = await sp('GET', '/pages');
                return { output: { pages: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getPage': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await sp('GET', `/pages/${pageId}`);
                return { output: { id: data.id, name: data.name, domain: data.domain ?? '', subdomain: data.subdomain ?? '' } };
            }

            case 'listComponents': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await sp('GET', `/pages/${pageId}/components`);
                return { output: { components: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getComponent': {
                const pageId = String(inputs.pageId ?? '').trim();
                const componentId = String(inputs.componentId ?? '').trim();
                if (!pageId || !componentId) throw new Error('pageId and componentId are required.');
                const data = await sp('GET', `/pages/${pageId}/components/${componentId}`);
                return { output: { id: data.id, name: data.name, status: data.status, description: data.description ?? '' } };
            }

            case 'createComponent': {
                const pageId = String(inputs.pageId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!pageId || !name) throw new Error('pageId and name are required.');
                const body: any = { component: { name, status: inputs.status ?? 'operational' } };
                if (inputs.description) body.component.description = String(inputs.description);
                if (inputs.groupId) body.component.group_id = String(inputs.groupId);
                const data = await sp('POST', `/pages/${pageId}/components`, body);
                return { output: { id: data.id, name: data.name, status: data.status } };
            }

            case 'updateComponent': {
                const pageId = String(inputs.pageId ?? '').trim();
                const componentId = String(inputs.componentId ?? '').trim();
                if (!pageId || !componentId) throw new Error('pageId and componentId are required.');
                const body: any = { component: {} };
                if (inputs.name) body.component.name = String(inputs.name);
                if (inputs.status) body.component.status = String(inputs.status);
                if (inputs.description !== undefined) body.component.description = String(inputs.description);
                const data = await sp('PATCH', `/pages/${pageId}/components/${componentId}`, body);
                return { output: { id: data.id, name: data.name, status: data.status } };
            }

            case 'deleteComponent': {
                const pageId = String(inputs.pageId ?? '').trim();
                const componentId = String(inputs.componentId ?? '').trim();
                if (!pageId || !componentId) throw new Error('pageId and componentId are required.');
                await sp('DELETE', `/pages/${pageId}/components/${componentId}`);
                return { output: { deleted: 'true', componentId } };
            }

            case 'listIncidents': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const q = inputs.q ? `?q=${encodeURIComponent(String(inputs.q))}` : '';
                const data = await sp('GET', `/pages/${pageId}/incidents${q}`);
                return { output: { incidents: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getIncident': {
                const pageId = String(inputs.pageId ?? '').trim();
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!pageId || !incidentId) throw new Error('pageId and incidentId are required.');
                const data = await sp('GET', `/pages/${pageId}/incidents/${incidentId}`);
                return { output: { id: data.id, name: data.name, status: data.status, impact: data.impact ?? '' } };
            }

            case 'createIncident': {
                const pageId = String(inputs.pageId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!pageId || !name) throw new Error('pageId and name are required.');
                const body: any = {
                    incident: {
                        name,
                        status: inputs.status ?? 'investigating',
                        impact_override: inputs.impact ?? 'minor',
                    },
                };
                if (inputs.body) body.incident.body = String(inputs.body);
                if (inputs.componentIds) body.incident.component_ids = inputs.componentIds;
                const data = await sp('POST', `/pages/${pageId}/incidents`, body);
                return { output: { id: data.id, name: data.name, status: data.status } };
            }

            case 'updateIncident': {
                const pageId = String(inputs.pageId ?? '').trim();
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!pageId || !incidentId) throw new Error('pageId and incidentId are required.');
                const body: any = { incident: {} };
                if (inputs.name) body.incident.name = String(inputs.name);
                if (inputs.status) body.incident.status = String(inputs.status);
                if (inputs.body) body.incident.body = String(inputs.body);
                const data = await sp('PATCH', `/pages/${pageId}/incidents/${incidentId}`, body);
                return { output: { id: data.id, name: data.name, status: data.status } };
            }

            case 'resolveIncident': {
                const pageId = String(inputs.pageId ?? '').trim();
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!pageId || !incidentId) throw new Error('pageId and incidentId are required.');
                const data = await sp('PATCH', `/pages/${pageId}/incidents/${incidentId}`, { incident: { status: 'resolved', body: inputs.body ?? 'This incident has been resolved.' } });
                return { output: { id: data.id, name: data.name, status: data.status } };
            }

            case 'deleteIncident': {
                const pageId = String(inputs.pageId ?? '').trim();
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!pageId || !incidentId) throw new Error('pageId and incidentId are required.');
                await sp('DELETE', `/pages/${pageId}/incidents/${incidentId}`);
                return { output: { deleted: 'true', incidentId } };
            }

            case 'listMetrics': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await sp('GET', `/pages/${pageId}/metrics`);
                return { output: { metrics: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'createMetricDatapoint': {
                const pageId = String(inputs.pageId ?? '').trim();
                const metricId = String(inputs.metricId ?? '').trim();
                const value = Number(inputs.value ?? 0);
                if (!pageId || !metricId) throw new Error('pageId and metricId are required.');
                const timestamp = inputs.timestamp ? Number(inputs.timestamp) : Math.floor(Date.now() / 1000);
                const data = await sp('POST', `/pages/${pageId}/metrics/${metricId}/data`, {
                    data: { timestamp, value },
                });
                return { output: { metricId, timestamp: String(timestamp), value: String(value) } };
            }

            case 'listSubscribers': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await sp('GET', `/pages/${pageId}/subscribers`);
                return { output: { subscribers: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'listMaintenances': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await sp('GET', `/pages/${pageId}/incidents/scheduled`);
                return { output: { maintenances: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'createMaintenance': {
                const pageId = String(inputs.pageId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const scheduledFor = String(inputs.scheduledFor ?? '').trim();
                const scheduledUntil = String(inputs.scheduledUntil ?? '').trim();
                if (!pageId || !name || !scheduledFor || !scheduledUntil) throw new Error('pageId, name, scheduledFor, and scheduledUntil are required.');
                const body: any = {
                    incident: {
                        name,
                        status: 'scheduled',
                        scheduled_for: scheduledFor,
                        scheduled_until: scheduledUntil,
                    },
                };
                if (inputs.body) body.incident.body = String(inputs.body);
                const data = await sp('POST', `/pages/${pageId}/incidents`, body);
                return { output: { id: data.id, name: data.name, status: data.status, scheduledFor: data.scheduled_for ?? scheduledFor } };
            }

            default:
                return { error: `Statuspage action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Statuspage action failed.' };
    }
}
