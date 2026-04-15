'use server';

async function pdFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[PagerDuty Enhanced] ${method} ${path}`);
    const url = `https://api.pagerduty.com${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Token token=${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.pagerduty+json;version=2',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `PagerDuty API error: ${res.status}`);
    }
    return data;
}

export async function executePagerdutyEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const pd = (method: string, path: string, body?: any) => pdFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listIncidents': {
                const params = new URLSearchParams();
                if (inputs.statuses) params.set('statuses[]', inputs.statuses);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const data = await pd('GET', `/incidents?${params.toString()}`);
                return { output: data };
            }

            case 'getIncident': {
                if (!inputs.incidentId) throw new Error('incidentId is required.');
                const data = await pd('GET', `/incidents/${inputs.incidentId}`);
                return { output: data };
            }

            case 'createIncident': {
                if (!inputs.title) throw new Error('title is required.');
                if (!inputs.serviceId) throw new Error('serviceId is required.');
                const body = {
                    incident: {
                        type: 'incident',
                        title: inputs.title,
                        service: { id: inputs.serviceId, type: 'service_reference' },
                        ...(inputs.urgency && { urgency: inputs.urgency }),
                        ...(inputs.body && { body: { type: 'incident_body', details: inputs.body } }),
                        ...(inputs.escalationPolicyId && {
                            escalation_policy: { id: inputs.escalationPolicyId, type: 'escalation_policy_reference' },
                        }),
                    },
                };
                const data = await pd('POST', '/incidents', body);
                return { output: data };
            }

            case 'updateIncident': {
                if (!inputs.incidentId) throw new Error('incidentId is required.');
                const body: any = { incident: { type: 'incident' } };
                if (inputs.title) body.incident.title = inputs.title;
                if (inputs.status) body.incident.status = inputs.status;
                if (inputs.urgency) body.incident.urgency = inputs.urgency;
                if (inputs.resolution) body.incident.resolution = inputs.resolution;
                const data = await pd('PUT', `/incidents/${inputs.incidentId}`, body);
                return { output: data };
            }

            case 'resolveIncident': {
                if (!inputs.incidentId) throw new Error('incidentId is required.');
                const body = { incident: { type: 'incident', status: 'resolved' } };
                const data = await pd('PUT', `/incidents/${inputs.incidentId}`, body);
                return { output: data };
            }

            case 'acknowledgeIncident': {
                if (!inputs.incidentId) throw new Error('incidentId is required.');
                const body = { incident: { type: 'incident', status: 'acknowledged' } };
                const data = await pd('PUT', `/incidents/${inputs.incidentId}`, body);
                return { output: data };
            }

            case 'listServices': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.query) params.set('query', inputs.query);
                const data = await pd('GET', `/services?${params.toString()}`);
                return { output: data };
            }

            case 'getService': {
                if (!inputs.serviceId) throw new Error('serviceId is required.');
                const data = await pd('GET', `/services/${inputs.serviceId}`);
                return { output: data };
            }

            case 'createService': {
                if (!inputs.name) throw new Error('name is required.');
                if (!inputs.escalationPolicyId) throw new Error('escalationPolicyId is required.');
                const body = {
                    service: {
                        name: inputs.name,
                        escalation_policy: { id: inputs.escalationPolicyId, type: 'escalation_policy_reference' },
                        ...(inputs.description && { description: inputs.description }),
                        ...(inputs.alertCreation && { alert_creation: inputs.alertCreation }),
                    },
                };
                const data = await pd('POST', '/services', body);
                return { output: data };
            }

            case 'updateService': {
                if (!inputs.serviceId) throw new Error('serviceId is required.');
                const body: any = { service: {} };
                if (inputs.name) body.service.name = inputs.name;
                if (inputs.description) body.service.description = inputs.description;
                if (inputs.status) body.service.status = inputs.status;
                const data = await pd('PUT', `/services/${inputs.serviceId}`, body);
                return { output: data };
            }

            case 'listEscalationPolicies': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', inputs.query);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await pd('GET', `/escalation_policies?${params.toString()}`);
                return { output: data };
            }

            case 'getEscalationPolicy': {
                if (!inputs.escalationPolicyId) throw new Error('escalationPolicyId is required.');
                const data = await pd('GET', `/escalation_policies/${inputs.escalationPolicyId}`);
                return { output: data };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', inputs.query);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const data = await pd('GET', `/users?${params.toString()}`);
                return { output: data };
            }

            case 'getUser': {
                if (!inputs.userId) throw new Error('userId is required.');
                const data = await pd('GET', `/users/${inputs.userId}`);
                return { output: data };
            }

            case 'getOnCalls': {
                const params = new URLSearchParams();
                if (inputs.escalationPolicyIds) params.set('escalation_policy_ids[]', inputs.escalationPolicyIds);
                if (inputs.scheduleIds) params.set('schedule_ids[]', inputs.scheduleIds);
                if (inputs.since) params.set('since', inputs.since);
                if (inputs.until) params.set('until', inputs.until);
                const data = await pd('GET', `/oncalls?${params.toString()}`);
                return { output: data };
            }

            default:
                throw new Error(`Unknown PagerDuty Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[PagerDuty Enhanced] Error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
