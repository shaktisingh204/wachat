
'use server';

async function hiveRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    serverUrl: string,
    path: string,
    apiKey: string,
    body?: any,
    queryParams?: Record<string, string | number | undefined>
): Promise<any> {
    const base = `${serverUrl.replace(/\/$/, '')}/api`;
    let url = `${base}${path}`;

    if (queryParams) {
        const filtered = Object.entries(queryParams).filter(
            ([, v]) => v !== undefined && v !== null && v !== ''
        );
        if (filtered.length > 0) {
            url += '?' + filtered.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
        }
    }

    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        let errMsg = `TheHive API error ${res.status}`;
        try {
            const errBody = await res.json();
            errMsg = errBody.message || errBody.type || JSON.stringify(errBody) || errMsg;
        } catch {
            errMsg = (await res.text()) || errMsg;
        }
        throw new Error(errMsg);
    }

    if (res.status === 204) return {};
    return res.json();
}

export async function executeTheHiveAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!serverUrl) throw new Error('serverUrl is required.');
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'listCases': {
                const page = Number(inputs.page ?? 0);
                const pageSize = Number(inputs.pageSize ?? 25);
                const params: Record<string, string | number | undefined> = {
                    range: `${page}-${page + pageSize}`,
                    sort: '-updatedAt',
                };
                if (inputs.status) params['query[status]'] = String(inputs.status);
                if (inputs.severity) params['query[severity]'] = String(inputs.severity);
                const data = await hiveRequest('GET', serverUrl, '/case', apiKey, undefined, params);
                const cases = (Array.isArray(data) ? data : []).map((c: any) => ({
                    _id: c._id,
                    caseId: c.caseId,
                    title: c.title,
                    description: c.description,
                    severity: c.severity,
                    status: c.status,
                    tlp: c.tlp,
                }));
                return { output: { cases } };
            }

            case 'getCase': {
                const caseId = String(inputs.caseId ?? '').trim();
                if (!caseId) throw new Error('caseId is required.');
                const data = await hiveRequest('GET', serverUrl, `/case/${caseId}`, apiKey);
                return {
                    output: {
                        _id: data._id,
                        caseId: data.caseId,
                        title: data.title,
                        description: data.description,
                        severity: data.severity,
                        status: data.status,
                        owner: data.owner,
                        assignee: data.assignee,
                    },
                };
            }

            case 'createCase': {
                const title = String(inputs.title ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                if (!title) throw new Error('title is required.');
                if (!description) throw new Error('description is required.');
                const body: Record<string, any> = {
                    title,
                    description,
                    severity: inputs.severity ?? 2,
                    tlp: inputs.tlp ?? 2,
                    pap: inputs.pap ?? 2,
                    tags: inputs.tags ?? [],
                    flag: inputs.flag ?? false,
                };
                const data = await hiveRequest('POST', serverUrl, '/case', apiKey, body);
                logger.log(`[TheHive] Created case ${data._id}`);
                return { output: { _id: data._id, caseId: data.caseId, title: data.title } };
            }

            case 'updateCase': {
                const caseId = String(inputs.caseId ?? '').trim();
                if (!caseId) throw new Error('caseId is required.');
                if (!inputs.data || typeof inputs.data !== 'object') throw new Error('data (object) is required.');
                const data = await hiveRequest('PATCH', serverUrl, `/case/${caseId}`, apiKey, inputs.data);
                return { output: { _id: data._id } };
            }

            case 'closeCase': {
                const caseId = String(inputs.caseId ?? '').trim();
                const resolutionStatus = String(inputs.resolutionStatus ?? '').trim();
                const summary = String(inputs.summary ?? '').trim();
                if (!caseId) throw new Error('caseId is required.');
                if (!resolutionStatus) throw new Error('resolutionStatus is required.');
                if (!summary) throw new Error('summary is required.');
                const data = await hiveRequest('PATCH', serverUrl, `/case/${caseId}`, apiKey, {
                    status: 'Resolved',
                    resolutionStatus,
                    summary,
                    endDate: Date.now(),
                });
                return { output: { _id: data._id } };
            }

            case 'deleteCase': {
                const caseId = String(inputs.caseId ?? '').trim();
                if (!caseId) throw new Error('caseId is required.');
                await hiveRequest('DELETE', serverUrl, `/case/${caseId}`, apiKey);
                logger.log(`[TheHive] Deleted case ${caseId}`);
                return { output: { deleted: true } };
            }

            case 'listObservables': {
                const caseId = String(inputs.caseId ?? '').trim();
                if (!caseId) throw new Error('caseId is required.');
                const data = await hiveRequest('GET', serverUrl, `/case/${caseId}/artifact`, apiKey);
                const observables = (Array.isArray(data) ? data : []).map((o: any) => ({
                    _id: o._id,
                    dataType: o.dataType,
                    data: o.data,
                    message: o.message,
                }));
                return { output: { observables } };
            }

            case 'createObservable': {
                const caseId = String(inputs.caseId ?? '').trim();
                const dataType = String(inputs.dataType ?? '').trim();
                const data = String(inputs.data ?? '').trim();
                if (!caseId) throw new Error('caseId is required.');
                if (!dataType) throw new Error('dataType is required.');
                if (!data) throw new Error('data is required.');
                const body: Record<string, any> = {
                    dataType,
                    data,
                    message: inputs.message,
                    tags: inputs.tags ?? [],
                    ioc: inputs.ioc ?? false,
                    sighted: inputs.sighted ?? false,
                };
                const resp = await hiveRequest('POST', serverUrl, `/case/${caseId}/artifact`, apiKey, body);
                const created = Array.isArray(resp) ? resp[0] : resp;
                logger.log(`[TheHive] Created observable ${created._id}`);
                return { output: { _id: created._id, dataType: created.dataType, data: created.data } };
            }

            case 'listTasks': {
                const caseId = String(inputs.caseId ?? '').trim();
                if (!caseId) throw new Error('caseId is required.');
                const data = await hiveRequest('GET', serverUrl, `/case/${caseId}/task`, apiKey);
                const tasks = (Array.isArray(data) ? data : []).map((t: any) => ({
                    _id: t._id,
                    title: t.title,
                    status: t.status,
                }));
                return { output: { tasks } };
            }

            case 'createTask': {
                const caseId = String(inputs.caseId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!caseId) throw new Error('caseId is required.');
                if (!title) throw new Error('title is required.');
                const body: Record<string, any> = { title };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.assignee) body.owner = String(inputs.assignee);
                if (inputs.dueDate) body.dueDate = inputs.dueDate;
                const resp = await hiveRequest('POST', serverUrl, `/case/${caseId}/task`, apiKey, body);
                logger.log(`[TheHive] Created task ${resp._id}`);
                return { output: { _id: resp._id, title: resp.title } };
            }

            case 'createAlert': {
                const title = String(inputs.title ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                const type = String(inputs.type ?? '').trim();
                const source = String(inputs.source ?? '').trim();
                const sourceRef = String(inputs.sourceRef ?? '').trim();
                if (!title) throw new Error('title is required.');
                if (!description) throw new Error('description is required.');
                if (!type) throw new Error('type is required.');
                if (!source) throw new Error('source is required.');
                if (!sourceRef) throw new Error('sourceRef is required.');
                const body: Record<string, any> = {
                    title,
                    description,
                    type,
                    source,
                    sourceRef,
                    severity: inputs.severity ?? 2,
                    artifacts: inputs.artifacts ?? [],
                    customFields: inputs.customFields ?? {},
                };
                const data = await hiveRequest('POST', serverUrl, '/alert', apiKey, body);
                logger.log(`[TheHive] Created alert ${data._id}`);
                return { output: { _id: data._id, id: data.id, title: data.title, status: data.status } };
            }

            case 'getAlert': {
                const alertId = String(inputs.alertId ?? '').trim();
                if (!alertId) throw new Error('alertId is required.');
                const data = await hiveRequest('GET', serverUrl, `/alert/${alertId}`, apiKey);
                return {
                    output: {
                        _id: data._id,
                        title: data.title,
                        description: data.description,
                        type: data.type,
                        status: data.status,
                    },
                };
            }

            case 'listAlerts': {
                const queryObj: Record<string, any> = {};
                const conditions: any[] = [];
                if (inputs.status) conditions.push({ status: String(inputs.status) });
                if (inputs.type) conditions.push({ type: String(inputs.type) });
                const q = conditions.length > 0 ? { _and: conditions } : { _wildcard: { title: '*' } };
                const params: Record<string, string | number | undefined> = {
                    range: '0-25',
                    sort: '-updatedAt',
                    query: JSON.stringify(q),
                };
                const data = await hiveRequest('GET', serverUrl, '/alert', apiKey, undefined, params);
                return { output: { alerts: Array.isArray(data) ? data : [] } };
            }

            case 'promoteAlertToCase': {
                const alertId = String(inputs.alertId ?? '').trim();
                if (!alertId) throw new Error('alertId is required.');
                const body: Record<string, any> = {};
                if (inputs.caseTemplate) body.caseTemplate = String(inputs.caseTemplate);
                const data = await hiveRequest('POST', serverUrl, `/alert/${alertId}/createCase`, apiKey, body);
                logger.log(`[TheHive] Promoted alert ${alertId} to case ${data._id}`);
                return { output: { _id: data._id, caseId: data.caseId } };
            }

            default:
                return { error: `TheHive action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger.log(`[TheHive] Error in action "${actionName}": ${e.message}`);
        return { error: e.message || 'TheHive action failed.' };
    }
}
