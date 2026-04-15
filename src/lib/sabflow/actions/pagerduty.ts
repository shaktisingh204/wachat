'use server';

async function pagerdutyFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[PagerDuty] ${method} ${path}`);
    const url = `https://api.pagerduty.com${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Token token=${apiKey}`,
            Accept: 'application/vnd.pagerduty+json;version=2',
            'Content-Type': 'application/json',
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

export async function executePagerdutyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const pd = (method: string, path: string, body?: any) =>
            pagerdutyFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listIncidents': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('statuses[]', String(inputs.status));
                if (inputs.serviceIds) {
                    const ids: string[] = Array.isArray(inputs.serviceIds)
                        ? inputs.serviceIds
                        : String(inputs.serviceIds).split(',').map((s: string) => s.trim());
                    ids.forEach((id) => params.append('service_ids[]', id));
                }
                const data = await pd('GET', `/incidents?${params.toString()}`);
                const incidents = data.incidents ?? [];
                return { output: { incidents } };
            }

            case 'getIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const data = await pd('GET', `/incidents/${incidentId}`);
                const incident = data.incident ?? data;
                return {
                    output: {
                        id: String(incident.id ?? incidentId),
                        title: incident.title ?? '',
                        status: incident.status ?? '',
                        urgency: incident.urgency ?? '',
                    },
                };
            }

            case 'createIncident': {
                const title = String(inputs.title ?? '').trim();
                const serviceId = String(inputs.serviceId ?? '').trim();
                if (!title || !serviceId) throw new Error('title and serviceId are required.');
                const body: Record<string, any> = {
                    incident: {
                        type: 'incident',
                        title,
                        service: { id: serviceId, type: 'service_reference' },
                        urgency: String(inputs.urgency ?? 'high'),
                    },
                };
                if (inputs.body) {
                    body.incident.body = { type: 'incident_body', details: String(inputs.body) };
                }
                const data = await pd('POST', '/incidents', body);
                const incident = data.incident ?? data;
                return { output: { id: String(incident.id ?? ''), title: incident.title ?? title } };
            }

            case 'updateIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const body: Record<string, any> = { incident: { type: 'incident' } };
                if (inputs.status !== undefined) body.incident.status = String(inputs.status);
                if (inputs.resolution !== undefined) body.incident.resolution = String(inputs.resolution);
                const data = await pd('PUT', `/incidents/${incidentId}`, body);
                const incident = data.incident ?? data;
                return { output: { id: String(incident.id ?? incidentId) } };
            }

            case 'resolveIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                await pd('PUT', `/incidents/${incidentId}`, {
                    incident: { type: 'incident', status: 'resolved' },
                });
                return { output: { status: 'resolved' } };
            }

            case 'listServices': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', String(inputs.query));
                if (inputs.teamIds) {
                    const ids: string[] = Array.isArray(inputs.teamIds)
                        ? inputs.teamIds
                        : String(inputs.teamIds).split(',').map((s: string) => s.trim());
                    ids.forEach((id) => params.append('team_ids[]', id));
                }
                const data = await pd('GET', `/services?${params.toString()}`);
                const services = data.services ?? [];
                return { output: { services } };
            }

            case 'getService': {
                const serviceId = String(inputs.serviceId ?? '').trim();
                if (!serviceId) throw new Error('serviceId is required.');
                const data = await pd('GET', `/services/${serviceId}`);
                const service = data.service ?? data;
                return {
                    output: {
                        id: String(service.id ?? serviceId),
                        name: service.name ?? '',
                        status: service.status ?? '',
                    },
                };
            }

            case 'createService': {
                const name = String(inputs.name ?? '').trim();
                const escalationPolicyId = String(inputs.escalationPolicyId ?? '').trim();
                if (!name || !escalationPolicyId) throw new Error('name and escalationPolicyId are required.');
                const body: Record<string, any> = {
                    service: {
                        name,
                        escalation_policy: { id: escalationPolicyId, type: 'escalation_policy_reference' },
                        alert_creation: 'create_alerts_and_incidents',
                    },
                };
                if (inputs.description) body.service.description = String(inputs.description);
                const data = await pd('POST', '/services', body);
                const service = data.service ?? data;
                return { output: { id: String(service.id ?? '') } };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', String(inputs.query));
                const data = await pd('GET', `/users?${params.toString()}`);
                const users = data.users ?? [];
                return { output: { users } };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const data = await pd('GET', `/users/${userId}`);
                const u = data.user ?? data;
                return {
                    output: {
                        id: String(u.id ?? userId),
                        name: u.name ?? '',
                        email: u.email ?? '',
                    },
                };
            }

            case 'createSchedule': {
                const name = String(inputs.name ?? '').trim();
                const timeZone = String(inputs.timeZone ?? 'UTC').trim();
                let layers: any[] = [];
                if (inputs.layers) {
                    if (typeof inputs.layers === 'string') {
                        try {
                            layers = JSON.parse(inputs.layers);
                        } catch {
                            throw new Error('layers must be valid JSON.');
                        }
                    } else if (Array.isArray(inputs.layers)) {
                        layers = inputs.layers;
                    }
                }
                if (!name) throw new Error('name is required.');
                const data = await pd('POST', '/schedules', {
                    schedule: {
                        name,
                        time_zone: timeZone,
                        schedule_layers: layers,
                    },
                });
                const schedule = data.schedule ?? data;
                return { output: { id: String(schedule.id ?? '') } };
            }

            case 'listAlerts': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const data = await pd('GET', `/incidents/${incidentId}/alerts`);
                const alerts = data.alerts ?? [];
                return { output: { alerts } };
            }

            case 'triggerAlert': {
                const integrationKey = String(inputs.integrationKey ?? '').trim();
                const summary = String(inputs.summary ?? '').trim();
                if (!integrationKey || !summary) throw new Error('integrationKey and summary are required.');
                const severity = String(inputs.severity ?? 'error');
                const payload: Record<string, any> = {
                    routing_key: integrationKey,
                    event_action: 'trigger',
                    payload: {
                        summary,
                        severity,
                        source: 'SabFlow',
                    },
                };
                if (inputs.details) {
                    payload.payload.custom_details = typeof inputs.details === 'string'
                        ? { info: inputs.details }
                        : inputs.details;
                }
                logger?.log(`[PagerDuty] POST https://events.pagerduty.com/v2/enqueue`);
                const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.message || `PagerDuty Events API error: ${res.status}`);
                }
                return { output: { incidentKey: data.dedup_key ?? data.incident_key ?? '' } };
            }

            case 'listEscalationPolicies': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', String(inputs.query));
                const data = await pd('GET', `/escalation_policies?${params.toString()}`);
                const policies = data.escalation_policies ?? [];
                return { output: { policies } };
            }

            default:
                return { error: `PagerDuty action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'PagerDuty action failed.' };
    }
}
