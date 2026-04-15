'use server';

async function ogFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[OpsGenie Enhanced] ${method} ${path}`);
    const url = `https://api.opsgenie.com/v2${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `GenieKey ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 202 || res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `OpsGenie API error: ${res.status}`);
    }
    return data;
}

export async function executeOpsgenieEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const og = (method: string, path: string, body?: any) => ogFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listAlerts': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', inputs.query);
                if (inputs.searchIdentifierType) params.set('searchIdentifierType', inputs.searchIdentifierType);
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.sort) params.set('sort', inputs.sort);
                if (inputs.order) params.set('order', inputs.order);
                const data = await og('GET', `/alerts?${params.toString()}`);
                return { output: data };
            }

            case 'getAlert': {
                if (!inputs.alertId) throw new Error('alertId is required.');
                const data = await og('GET', `/alerts/${inputs.alertId}`);
                return { output: data };
            }

            case 'createAlert': {
                if (!inputs.message) throw new Error('message is required.');
                const body: any = { message: inputs.message };
                if (inputs.description) body.description = inputs.description;
                if (inputs.alias) body.alias = inputs.alias;
                if (inputs.priority) body.priority = inputs.priority;
                if (inputs.tags) body.tags = Array.isArray(inputs.tags) ? inputs.tags : inputs.tags.split(',');
                if (inputs.details) body.details = typeof inputs.details === 'string' ? JSON.parse(inputs.details) : inputs.details;
                if (inputs.source) body.source = inputs.source;
                const data = await og('POST', '/alerts', body);
                return { output: data };
            }

            case 'closeAlert': {
                if (!inputs.alertId) throw new Error('alertId is required.');
                const body: any = {};
                if (inputs.note) body.note = inputs.note;
                if (inputs.source) body.source = inputs.source;
                const data = await og('POST', `/alerts/${inputs.alertId}/close`, body);
                return { output: data };
            }

            case 'acknowledgeAlert': {
                if (!inputs.alertId) throw new Error('alertId is required.');
                const body: any = {};
                if (inputs.note) body.note = inputs.note;
                if (inputs.source) body.source = inputs.source;
                const data = await og('POST', `/alerts/${inputs.alertId}/acknowledge`, body);
                return { output: data };
            }

            case 'unacknowledgeAlert': {
                if (!inputs.alertId) throw new Error('alertId is required.');
                const body: any = {};
                if (inputs.note) body.note = inputs.note;
                const data = await og('POST', `/alerts/${inputs.alertId}/unacknowledge`, body);
                return { output: data };
            }

            case 'snoozeAlert': {
                if (!inputs.alertId) throw new Error('alertId is required.');
                if (!inputs.endTime) throw new Error('endTime is required.');
                const body: any = { endTime: inputs.endTime };
                if (inputs.note) body.note = inputs.note;
                const data = await og('POST', `/alerts/${inputs.alertId}/snooze`, body);
                return { output: data };
            }

            case 'addNoteToAlert': {
                if (!inputs.alertId) throw new Error('alertId is required.');
                if (!inputs.note) throw new Error('note is required.');
                const body: any = { note: inputs.note };
                if (inputs.source) body.source = inputs.source;
                const data = await og('POST', `/alerts/${inputs.alertId}/notes`, body);
                return { output: data };
            }

            case 'listAlertNotes': {
                if (!inputs.alertId) throw new Error('alertId is required.');
                const params = new URLSearchParams();
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.order) params.set('order', inputs.order);
                const data = await og('GET', `/alerts/${inputs.alertId}/notes?${params.toString()}`);
                return { output: data };
            }

            case 'listOnCalls': {
                if (!inputs.scheduleId) throw new Error('scheduleId is required.');
                const params = new URLSearchParams();
                if (inputs.flat) params.set('flat', String(inputs.flat));
                if (inputs.date) params.set('date', inputs.date);
                const data = await og('GET', `/schedules/${inputs.scheduleId}/on-calls?${params.toString()}`);
                return { output: data };
            }

            case 'getSchedule': {
                if (!inputs.scheduleId) throw new Error('scheduleId is required.');
                const data = await og('GET', `/schedules/${inputs.scheduleId}`);
                return { output: data };
            }

            case 'listSchedules': {
                const params = new URLSearchParams();
                if (inputs.expand) params.set('expand', inputs.expand);
                const data = await og('GET', `/schedules?${params.toString()}`);
                return { output: data };
            }

            case 'createSchedule': {
                if (!inputs.name) throw new Error('name is required.');
                if (!inputs.timezone) throw new Error('timezone is required.');
                const body: any = {
                    name: inputs.name,
                    timezone: inputs.timezone,
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.enabled !== undefined) body.enabled = inputs.enabled;
                if (inputs.rotations) body.rotations = typeof inputs.rotations === 'string' ? JSON.parse(inputs.rotations) : inputs.rotations;
                const data = await og('POST', '/schedules', body);
                return { output: data };
            }

            case 'updateSchedule': {
                if (!inputs.scheduleId) throw new Error('scheduleId is required.');
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.timezone) body.timezone = inputs.timezone;
                if (inputs.description) body.description = inputs.description;
                if (inputs.enabled !== undefined) body.enabled = inputs.enabled;
                const data = await og('PATCH', `/schedules/${inputs.scheduleId}`, body);
                return { output: data };
            }

            case 'deleteSchedule': {
                if (!inputs.scheduleId) throw new Error('scheduleId is required.');
                await og('DELETE', `/schedules/${inputs.scheduleId}`);
                return { output: { success: true, scheduleId: inputs.scheduleId } };
            }

            default:
                throw new Error(`Unknown OpsGenie Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[OpsGenie Enhanced] Error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
