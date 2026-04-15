'use server';

export async function executeIncidentIOAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const baseUrl = 'https://api.incident.io/v2';

        async function ioFetch(method: string, path: string, body?: any) {
            logger?.log(`[Incident.io] ${method} ${path}`);
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || data?.message || `API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listIncidents': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.after) params.set('after', String(inputs.after));
                if (inputs.status) params.set('status[]', String(inputs.status));
                const data = await ioFetch('GET', `/incidents?${params.toString()}`);
                return { output: { incidents: data.incidents, pagination_meta: data.pagination_meta } };
            }
            case 'getIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const data = await ioFetch('GET', `/incidents/${incidentId}`);
                return { output: { incident: data.incident } };
            }
            case 'createIncident': {
                const body: any = {
                    name: String(inputs.name ?? '').trim(),
                    mode: inputs.mode || 'real',
                };
                if (inputs.summary) body.summary = inputs.summary;
                if (inputs.severityId) body.severity = { id: inputs.severityId };
                if (inputs.incidentTypeId) body.incident_type = { id: inputs.incidentTypeId };
                if (inputs.idempotencyKey) body.idempotency_key = inputs.idempotencyKey;
                if (inputs.slackChannelNameOverride) body.slack_channel_name_override = inputs.slackChannelNameOverride;
                const data = await ioFetch('POST', '/incidents', body);
                return { output: { incident: data.incident } };
            }
            case 'updateIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.summary) body.summary = inputs.summary;
                if (inputs.severityId) body.severity = { id: inputs.severityId };
                if (inputs.incidentStatusId) body.incident_status = { id: inputs.incidentStatusId };
                const data = await ioFetch('PATCH', `/incidents/${incidentId}`, body);
                return { output: { incident: data.incident } };
            }
            case 'closeIncident': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                // Get the closed status id first then update
                const statusesData = await ioFetch('GET', '/incident_statuses');
                const closedStatus = statusesData.incident_statuses?.find((s: any) => s.category === 'closed');
                if (!closedStatus) throw new Error('No closed status found.');
                const data = await ioFetch('PATCH', `/incidents/${incidentId}`, {
                    incident_status: { id: closedStatus.id },
                });
                return { output: { incident: data.incident } };
            }
            case 'listIncidentRoles': {
                const data = await ioFetch('GET', '/incident_roles');
                return { output: { incident_roles: data.incident_roles } };
            }
            case 'listSeverities': {
                const data = await ioFetch('GET', '/severities');
                return { output: { severities: data.severities } };
            }
            case 'getSeverity': {
                const severityId = String(inputs.severityId ?? '').trim();
                if (!severityId) throw new Error('severityId is required.');
                const data = await ioFetch('GET', `/severities/${severityId}`);
                return { output: { severity: data.severity } };
            }
            case 'createSeverity': {
                const body: any = {
                    name: String(inputs.name ?? '').trim(),
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.rank) body.rank = Number(inputs.rank);
                const data = await ioFetch('POST', '/severities', body);
                return { output: { severity: data.severity } };
            }
            case 'listIncidentTypes': {
                const data = await ioFetch('GET', '/incident_types');
                return { output: { incident_types: data.incident_types } };
            }
            case 'getIncidentType': {
                const incidentTypeId = String(inputs.incidentTypeId ?? '').trim();
                if (!incidentTypeId) throw new Error('incidentTypeId is required.');
                const data = await ioFetch('GET', `/incident_types/${incidentTypeId}`);
                return { output: { incident_type: data.incident_type } };
            }
            case 'listStatuses': {
                const data = await ioFetch('GET', '/incident_statuses');
                return { output: { incident_statuses: data.incident_statuses } };
            }
            case 'listActions': {
                const params = new URLSearchParams();
                if (inputs.incidentId) params.set('incident_id', String(inputs.incidentId));
                if (inputs.isFollowUp !== undefined) params.set('is_follow_up', String(inputs.isFollowUp));
                const data = await ioFetch('GET', `/actions?${params.toString()}`);
                return { output: { actions: data.actions } };
            }
            case 'createAction': {
                const incidentId = String(inputs.incidentId ?? '').trim();
                if (!incidentId) throw new Error('incidentId is required.');
                const body: any = {
                    description: String(inputs.description ?? '').trim(),
                    incident_id: incidentId,
                };
                if (inputs.assigneeId) body.assignee = { id: inputs.assigneeId };
                if (inputs.followUpFor) body.follow_up_for = inputs.followUpFor;
                const data = await ioFetch('POST', '/actions', body);
                return { output: { action: data.action } };
            }
            case 'updateAction': {
                const actionId = String(inputs.actionId ?? '').trim();
                if (!actionId) throw new Error('actionId is required.');
                const body: any = {};
                if (inputs.description) body.description = inputs.description;
                if (inputs.status) body.status = inputs.status;
                if (inputs.assigneeId) body.assignee = { id: inputs.assigneeId };
                const data = await ioFetch('PATCH', `/actions/${actionId}`, body);
                return { output: { action: data.action } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
