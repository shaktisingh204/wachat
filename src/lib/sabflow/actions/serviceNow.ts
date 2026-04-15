'use server';

// ---------------------------------------------------------------------------
// ServiceNow – IT Service Management platform
// Docs: https://developer.servicenow.com/dev.do#!/reference/api/latest/rest
// ---------------------------------------------------------------------------

async function snowFetch(
    instance: string,
    authHeader: string,
    method: string,
    path: string,
    body?: any,
    rawBody?: BodyInit,
    extraHeaders?: Record<string, string>,
    logger?: any
): Promise<any> {
    const base = `https://${instance}.service-now.com/api`;
    const url = `${base}${path}`;
    logger?.log(`[ServiceNow] ${method} ${path}`);

    const headers: Record<string, string> = {
        Authorization: authHeader,
        Accept: 'application/json',
        ...extraHeaders,
    };
    // Only set Content-Type for JSON bodies, not raw uploads
    if (body !== undefined && rawBody === undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const options: RequestInit = { method, headers };
    if (rawBody !== undefined) {
        options.body = rawBody;
    } else if (body !== undefined) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    // 204 No Content
    if (res.status === 204) return {};

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }
    if (!res.ok) {
        const msg =
            data?.error?.message ??
            data?.error?.detail ??
            data?.message ??
            `ServiceNow API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

function buildAuthHeader(inputs: any): string {
    if (inputs.bearerToken) return `Bearer ${String(inputs.bearerToken).trim()}`;
    const username = String(inputs.username ?? '').trim();
    const password = String(inputs.password ?? '').trim();
    if (!username) throw new Error('"username" (or "bearerToken") is required.');
    if (!password) throw new Error('"password" (or "bearerToken") is required.');
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export async function executeServiceNowAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const instance = String(inputs.instance ?? '').trim();
        if (!instance) throw new Error('"instance" is required (e.g. dev12345).');
        const authHeader = buildAuthHeader(inputs);

        const snow = (method: string, path: string, body?: any) =>
            snowFetch(instance, authHeader, method, path, body, undefined, undefined, logger);

        switch (actionName) {
            // ── Generic Table API ─────────────────────────────────────────────
            case 'listRecords': {
                const table = String(inputs.table ?? '').trim();
                if (!table) throw new Error('"table" is required.');
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const query = encodeURIComponent(inputs.query ?? '');
                const fields = inputs.fields ?? '';
                const data = await snow(
                    'GET',
                    `/now/table/${table}?sysparm_limit=${limit}&sysparm_offset=${offset}&sysparm_query=${query}&sysparm_fields=${fields}`
                );
                return { output: { result: data.result ?? [] } };
            }

            case 'getRecord': {
                const table = String(inputs.table ?? '').trim();
                const sysId = String(inputs.sysId ?? '').trim();
                if (!table) throw new Error('"table" is required.');
                if (!sysId) throw new Error('"sysId" is required.');
                const data = await snow('GET', `/now/table/${table}/${sysId}`);
                return { output: { result: data.result ?? {} } };
            }

            case 'createRecord': {
                const table = String(inputs.table ?? '').trim();
                if (!table) throw new Error('"table" is required.');
                const payload =
                    typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data ?? {};
                const data = await snow('POST', `/now/table/${table}`, payload);
                return {
                    output: {
                        result: { sys_id: data.result?.sys_id, number: data.result?.number },
                    },
                };
            }

            case 'updateRecord': {
                const table = String(inputs.table ?? '').trim();
                const sysId = String(inputs.sysId ?? '').trim();
                if (!table) throw new Error('"table" is required.');
                if (!sysId) throw new Error('"sysId" is required.');
                const payload =
                    typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data ?? {};
                const data = await snow('PATCH', `/now/table/${table}/${sysId}`, payload);
                return { output: { result: { sys_id: data.result?.sys_id } } };
            }

            case 'deleteRecord': {
                const table = String(inputs.table ?? '').trim();
                const sysId = String(inputs.sysId ?? '').trim();
                if (!table) throw new Error('"table" is required.');
                if (!sysId) throw new Error('"sysId" is required.');
                await snow('DELETE', `/now/table/${table}/${sysId}`);
                return { output: { deleted: true } };
            }

            // ── Incidents ─────────────────────────────────────────────────────
            case 'createIncident': {
                const shortDescription = String(inputs.shortDescription ?? '').trim();
                if (!shortDescription) throw new Error('"shortDescription" is required.');
                const body: any = { short_description: shortDescription };
                if (inputs.description) body.description = String(inputs.description).trim();
                if (inputs.urgency !== undefined) body.urgency = String(inputs.urgency);
                if (inputs.impact !== undefined) body.impact = String(inputs.impact);
                if (inputs.callerSysId) body.caller_id = String(inputs.callerSysId).trim();
                const data = await snow('POST', '/now/table/incident', body);
                return {
                    output: {
                        result: {
                            sys_id: data.result?.sys_id,
                            number: data.result?.number,
                            state: data.result?.state,
                        },
                    },
                };
            }

            case 'getIncident': {
                const incidentNumber = String(inputs.incidentNumber ?? '').trim();
                if (!incidentNumber) throw new Error('"incidentNumber" is required.');
                const data = await snow(
                    'GET',
                    `/now/table/incident?sysparm_query=number=${encodeURIComponent(incidentNumber)}`
                );
                return { output: { result: data.result ?? [] } };
            }

            case 'updateIncident': {
                const sysId = String(inputs.sysId ?? '').trim();
                if (!sysId) throw new Error('"sysId" is required.');
                const body: any = {};
                if (inputs.state !== undefined) body.state = String(inputs.state);
                if (inputs.resolution) body.close_code = String(inputs.resolution).trim();
                if (inputs.closeNotes) body.close_notes = String(inputs.closeNotes).trim();
                const data = await snow('PATCH', `/now/table/incident/${sysId}`, body);
                return { output: { result: { sys_id: data.result?.sys_id } } };
            }

            // ── Change Requests ───────────────────────────────────────────────
            case 'createChange': {
                const shortDescription = String(inputs.shortDescription ?? '').trim();
                if (!shortDescription) throw new Error('"shortDescription" is required.');
                const body: any = {
                    short_description: shortDescription,
                    type: inputs.type ?? 'normal',
                };
                if (inputs.description) body.description = String(inputs.description).trim();
                const data = await snow('POST', '/now/table/change_request', body);
                return {
                    output: {
                        result: { sys_id: data.result?.sys_id, number: data.result?.number },
                    },
                };
            }

            // ── Knowledge Base ────────────────────────────────────────────────
            case 'searchKnowledge': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('"query" is required.');
                const data = await snow(
                    'GET',
                    `/now/table/kb_knowledge?sysparm_query=short_descriptionLIKE${encodeURIComponent(query)}&sysparm_limit=10`
                );
                return { output: { result: data.result ?? [] } };
            }

            // ── Users ─────────────────────────────────────────────────────────
            case 'getUser': {
                const userName = String(inputs.userName ?? '').trim();
                if (!userName) throw new Error('"userName" is required.');
                const data = await snow(
                    'GET',
                    `/now/table/sys_user?sysparm_query=user_name=${encodeURIComponent(userName)}`
                );
                return { output: { result: data.result ?? [] } };
            }

            // ── Attachments ───────────────────────────────────────────────────
            case 'attachFile': {
                const tableName = String(inputs.tableName ?? '').trim();
                const tableSysId = String(inputs.tableSysId ?? '').trim();
                const fileName = String(inputs.fileName ?? '').trim();
                if (!tableName) throw new Error('"tableName" is required.');
                if (!tableSysId) throw new Error('"tableSysId" is required.');
                if (!fileName) throw new Error('"fileName" is required.');
                if (inputs.fileContent === undefined || inputs.fileContent === null) {
                    throw new Error('"fileContent" is required.');
                }
                // Accept Buffer, Uint8Array, string, or base64 string
                let rawBody: BodyInit;
                if (typeof inputs.fileContent === 'string') {
                    // Treat as base64 if it looks like it, otherwise as plain text
                    try {
                        const buf = Buffer.from(inputs.fileContent, 'base64');
                        rawBody = buf;
                    } catch {
                        rawBody = inputs.fileContent;
                    }
                } else {
                    rawBody = inputs.fileContent;
                }
                const path = `/now/attachment/file?table_name=${encodeURIComponent(tableName)}&table_sys_id=${encodeURIComponent(tableSysId)}&file_name=${encodeURIComponent(fileName)}`;
                const data = await snowFetch(
                    instance,
                    authHeader,
                    'POST',
                    path,
                    undefined,
                    rawBody,
                    { 'Content-Type': 'application/octet-stream' },
                    logger
                );
                return { output: { result: { sys_id: data.result?.sys_id } } };
            }

            // ── Scripting ─────────────────────────────────────────────────────
            case 'runScript': {
                const script = String(inputs.script ?? '').trim();
                if (!script) throw new Error('"script" is required.');
                const data = await snow('POST', '/now/ui_action/execute', { script });
                return { output: { result: data.result ?? {} } };
            }

            // ── Flow Designer ─────────────────────────────────────────────────
            case 'triggerFlow': {
                const flowApiName = String(inputs.flowApiName ?? '').trim();
                if (!flowApiName) throw new Error('"flowApiName" is required.');
                const flowInputs =
                    typeof inputs.inputs === 'string'
                        ? JSON.parse(inputs.inputs)
                        : inputs.inputs ?? {};
                const data = await snow(
                    'POST',
                    `/sn_fd/flow_designer/api/now/v1/flow/${flowApiName}/run`,
                    { inputs: flowInputs }
                );
                return { output: { executionId: data.executionId ?? data.result?.executionId } };
            }

            default:
                return { error: `ServiceNow action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e.message || 'ServiceNow action failed.';
        logger?.log(`[ServiceNow] Error in "${actionName}": ${msg}`);
        return { error: msg };
    }
}
