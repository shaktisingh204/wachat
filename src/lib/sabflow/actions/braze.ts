'use server';

async function brazeFetch(
    restEndpoint: string,
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    params?: Record<string, string>,
    logger?: any
): Promise<any> {
    logger?.log(`[Braze] ${method} ${path}`);
    let url = `https://${restEndpoint}${path}`;
    if (params) {
        const qs = new URLSearchParams(params).toString();
        if (qs) url += `?${qs}`;
    }
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        const err = data?.message ?? data?.error ?? `Braze API error: ${res.status}`;
        throw new Error(String(err));
    }
    if (data?.errors?.length) throw new Error(data.errors[0] ?? 'Braze API error');
    return data;
}

export async function executeBrazeAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const restEndpoint = String(inputs.restEndpoint ?? '').trim().replace(/^https?:\/\//, '');
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!restEndpoint) throw new Error('restEndpoint is required.');
        if (!apiKey) throw new Error('apiKey is required.');

        const bz = (method: string, path: string, body?: any, params?: Record<string, string>) =>
            brazeFetch(restEndpoint, apiKey, method, path, body, params, logger);

        switch (actionName) {
            case 'trackUser': {
                const body: any = {};
                if (inputs.attributes) body.attributes = inputs.attributes;
                if (inputs.events) body.events = inputs.events;
                if (inputs.purchases) body.purchases = inputs.purchases;
                const data = await bz('POST', '/users/track', body);
                return { output: { result: data } };
            }

            case 'identifyUser': {
                const aliases_to_identify = inputs.aliases_to_identify ?? inputs.aliasesToIdentify;
                if (!aliases_to_identify) throw new Error('aliases_to_identify is required.');
                const data = await bz('POST', '/users/identify', { aliases_to_identify });
                return { output: { result: data } };
            }

            case 'deleteUser': {
                const user_ids = inputs.user_ids ?? inputs.userIds;
                if (!user_ids) throw new Error('user_ids is required.');
                const data = await bz('POST', '/users/delete', { user_ids });
                return { output: { result: data } };
            }

            case 'listSegments': {
                const params: Record<string, string> = {};
                if (inputs.page != null) params.page = String(inputs.page);
                if (inputs.sort_direction) params.sort_direction = String(inputs.sort_direction);
                const data = await bz('GET', '/segments/list', undefined, params);
                return { output: { segments: data?.segments ?? data } };
            }

            case 'getSegment': {
                const segment_id = String(inputs.segmentId ?? inputs.segment_id ?? '').trim();
                if (!segment_id) throw new Error('segmentId is required.');
                const data = await bz('GET', '/segments/details', undefined, { segment_id });
                return { output: { segment: data } };
            }

            case 'exportSegmentUsers': {
                const body: any = { segment_id: String(inputs.segmentId ?? inputs.segment_id ?? '') };
                if (inputs.callback_endpoint) body.callback_endpoint = String(inputs.callback_endpoint);
                if (inputs.fields_to_export) body.fields_to_export = inputs.fields_to_export;
                const data = await bz('POST', '/users/export/segment', body);
                return { output: { result: data } };
            }

            case 'listCampaigns': {
                const params: Record<string, string> = {};
                if (inputs.page != null) params.page = String(inputs.page);
                if (inputs.include_archived != null) params.include_archived = String(inputs.include_archived);
                const data = await bz('GET', '/campaigns/list', undefined, params);
                return { output: { campaigns: data?.campaigns ?? data } };
            }

            case 'getCampaign': {
                const campaign_id = String(inputs.campaignId ?? inputs.campaign_id ?? '').trim();
                if (!campaign_id) throw new Error('campaignId is required.');
                const data = await bz('GET', '/campaigns/details', undefined, { campaign_id });
                return { output: { campaign: data } };
            }

            case 'sendMessage': {
                const body: any = {};
                if (inputs.external_user_ids) body.external_user_ids = inputs.external_user_ids;
                if (inputs.segment_id) body.segment_id = String(inputs.segment_id);
                if (inputs.messages) body.messages = inputs.messages;
                if (inputs.campaign_id) body.campaign_id = String(inputs.campaign_id);
                const data = await bz('POST', '/messages/send', body);
                return { output: { result: data } };
            }

            case 'scheduleMessage': {
                const body = inputs.schedule ?? inputs;
                const data = await bz('POST', '/messages/schedule/create', body);
                return { output: { result: data } };
            }

            case 'updateSchedule': {
                const body = inputs.schedule ?? inputs;
                const data = await bz('POST', '/messages/schedule/update', body);
                return { output: { result: data } };
            }

            case 'deleteSchedule': {
                const scheduleId = String(inputs.scheduleId ?? inputs.schedule_id ?? '').trim();
                if (!scheduleId) throw new Error('scheduleId is required.');
                const data = await bz('POST', '/messages/schedule/delete', { schedule_id: scheduleId });
                return { output: { result: data } };
            }

            case 'listCanvases': {
                const params: Record<string, string> = {};
                if (inputs.page != null) params.page = String(inputs.page);
                if (inputs.include_archived != null) params.include_archived = String(inputs.include_archived);
                const data = await bz('GET', '/canvas/list', undefined, params);
                return { output: { canvases: data?.canvases ?? data } };
            }

            case 'sendEmailViaCanvas': {
                const body: any = {};
                if (inputs.canvas_id) body.canvas_id = String(inputs.canvas_id);
                if (inputs.recipients) body.recipients = inputs.recipients;
                if (inputs.canvas_entry_properties) body.canvas_entry_properties = inputs.canvas_entry_properties;
                const data = await bz('POST', '/canvas/trigger/send', body);
                return { output: { result: data } };
            }

            default:
                return { error: `Unknown Braze action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Braze] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Braze error' };
    }
}
