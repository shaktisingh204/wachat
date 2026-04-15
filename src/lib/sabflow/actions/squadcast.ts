'use server';

const SQUADCAST_BASE = 'https://api.squadcast.com/v3';
const SQUADCAST_AUTH_URL = 'https://auth.squadcast.com/oauth/access-token';

async function getSquadcastToken(refreshToken: string, logger?: any): Promise<string> {
    logger?.log('[Squadcast] Refreshing access token');
    const res = await fetch(SQUADCAST_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.meta?.error_message || data?.message || `Squadcast auth error: ${res.status}`);
    return data?.data?.access_token || data?.access_token;
}

async function squadcastFetch(token: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Squadcast] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${SQUADCAST_BASE}${path}`, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.meta?.error_message || data?.message || `Squadcast API error: ${res.status}`);
    return data?.data ?? data;
}

export async function executeSquadcastAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const refreshToken = String(inputs.refreshToken ?? '').trim();
        if (!refreshToken) throw new Error('refreshToken is required.');

        const accessToken = await getSquadcastToken(refreshToken, logger);
        const sq = (method: string, path: string, body?: any) =>
            squadcastFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listServices': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await sq('GET', `/services?team_id=${teamId}`);
                return { output: { services: Array.isArray(data) ? data : data.services ?? [] } };
            }

            case 'getService': {
                const serviceId = String(inputs.serviceId ?? '').trim();
                if (!serviceId) throw new Error('serviceId is required.');
                const data = await sq('GET', `/services/${serviceId}`);
                return { output: { service: data } };
            }

            case 'createService': {
                const name = String(inputs.name ?? '').trim();
                const teamId = String(inputs.teamId ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!teamId) throw new Error('teamId is required.');
                const body: any = { name, team_id: teamId };
                if (inputs.description) body.description = String(inputs.description).trim();
                if (inputs.escalationPolicyId) body.escalation_policy_id = String(inputs.escalationPolicyId).trim();
                const data = await sq('POST', `/services`, body);
                return { output: { service: data } };
            }

            case 'updateService': {
                const serviceId = String(inputs.serviceId ?? '').trim();
                if (!serviceId) throw new Error('serviceId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name).trim();
                if (inputs.description) body.description = String(inputs.description).trim();
                if (inputs.escalationPolicyId) body.escalation_policy_id = String(inputs.escalationPolicyId).trim();
                const data = await sq('PUT', `/services/${serviceId}`, body);
                return { output: { service: data } };
            }

            case 'deleteService': {
                const serviceId = String(inputs.serviceId ?? '').trim();
                if (!serviceId) throw new Error('serviceId is required.');
                await sq('DELETE', `/services/${serviceId}`);
                return { output: { success: true, serviceId } };
            }

            case 'listIncidents': {
                const params = new URLSearchParams();
                if (inputs.teamId) params.set('team_id', String(inputs.teamId).trim());
                if (inputs.serviceId) params.set('service_id', String(inputs.serviceId).trim());
                if (inputs.status) params.set('status', String(inputs.status).trim());
                if (inputs.limit) params.set('limit', String(Number(inputs.limit)));
                const query = params.toString();
                const data = await sq('GET', `/incidents${query ? '?' + query : ''}`);
                return { output: { incidents: Array.isArray(data) ? data : data.incidents ?? [] } };
            }

            case 'getIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const data = await sq('GET', `/incidents/${incidentId}`);
                return { output: { incident: data } };
            }

            case 'createIncident': {
                const message = String(inputs.message ?? '').trim();
                const serviceId = String(inputs.serviceId ?? '').trim();
                if (!message) throw new Error('message is required.');
                if (!serviceId) throw new Error('serviceId is required.');
                const body: any = { message, service_id: serviceId };
                if (inputs.description) body.description = String(inputs.description).trim();
                if (inputs.status) body.status = String(inputs.status).trim();
                const data = await sq('POST', `/incidents`, body);
                return { output: { incident: data } };
            }

            case 'updateIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const body: any = {};
                if (inputs.message) body.message = String(inputs.message).trim();
                if (inputs.description) body.description = String(inputs.description).trim();
                if (inputs.status) body.status = String(inputs.status).trim();
                const data = await sq('PATCH', `/incidents/${incidentId}`, body);
                return { output: { incident: data } };
            }

            case 'acknowledgeIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const data = await sq('PATCH', `/incidents/${incidentId}/acknowledge`);
                return { output: { success: true, incidentId, incident: data } };
            }

            case 'resolveIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const data = await sq('PATCH', `/incidents/${incidentId}/resolve`);
                return { output: { success: true, incidentId, incident: data } };
            }

            case 'listEscalationPolicies': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await sq('GET', `/escalation-policies?team_id=${teamId}`);
                return { output: { escalationPolicies: Array.isArray(data) ? data : data.escalation_policies ?? [] } };
            }

            case 'getEscalationPolicy': {
                const policyId = String(inputs.policyId ?? '').trim();
                if (!policyId) throw new Error('policyId is required.');
                const data = await sq('GET', `/escalation-policies/${policyId}`);
                return { output: { escalationPolicy: data } };
            }

            case 'listSchedules': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await sq('GET', `/schedules?team_id=${teamId}`);
                return { output: { schedules: Array.isArray(data) ? data : data.schedules ?? [] } };
            }

            case 'getSchedule': {
                const scheduleId = String(inputs.scheduleId ?? '').trim();
                if (!scheduleId) throw new Error('scheduleId is required.');
                const data = await sq('GET', `/schedules/${scheduleId}`);
                return { output: { schedule: data } };
            }

            default:
                throw new Error(`Unknown Squadcast action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
