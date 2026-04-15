
'use server';

const SF_API_VERSION = 'v58.0';

async function sfFetch(
    instanceUrl: string,
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${instanceUrl}/services/data/${SF_API_VERSION}${path}`;
    logger?.log(`[Salesforce] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    // 204 No Content (e.g. DELETE success)
    if (res.status === 204) return { success: true };

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        const errMsg = Array.isArray(data)
            ? data.map((e: any) => e.message || JSON.stringify(e)).join('; ')
            : (data?.message ?? `Salesforce API error: ${res.status}`);
        throw new Error(errMsg);
    }
    return data;
}

function parseJson(value: any, fieldName: string): any {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(String(value));
    } catch {
        throw new Error(`"${fieldName}" must be valid JSON.`);
    }
}

export async function executeSalesforceAction(
    actionName: string,
    inputs: any,
    _user: any,
    logger: any
) {
    try {
        const instanceUrl = String(inputs.instanceUrl ?? '').trim().replace(/\/$/, '');
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!instanceUrl) throw new Error('"instanceUrl" is required.');
        if (!accessToken) throw new Error('"accessToken" is required.');

        const sf = (method: string, path: string, body?: any) =>
            sfFetch(instanceUrl, accessToken, method, path, body, logger);

        switch (actionName) {
            case 'createRecord': {
                const objectType = String(inputs.objectType ?? '').trim();
                if (!objectType) throw new Error('"objectType" is required.');
                const fields = parseJson(inputs.fields, 'fields');
                if (!fields || typeof fields !== 'object') throw new Error('"fields" must be a JSON object.');
                logger.log(`[Salesforce] createRecord ${objectType}`);
                const data = await sf('POST', `/sobjects/${objectType}`, fields);
                return { output: { id: data.id, success: data.success, errors: data.errors ?? [] } };
            }

            case 'getRecord': {
                const objectType = String(inputs.objectType ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!objectType) throw new Error('"objectType" is required.');
                if (!recordId) throw new Error('"recordId" is required.');
                logger.log(`[Salesforce] getRecord ${objectType}/${recordId}`);
                const data = await sf('GET', `/sobjects/${objectType}/${recordId}`);
                return { output: { record: data } };
            }

            case 'updateRecord': {
                const objectType = String(inputs.objectType ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!objectType) throw new Error('"objectType" is required.');
                if (!recordId) throw new Error('"recordId" is required.');
                const fields = parseJson(inputs.fields, 'fields');
                if (!fields || typeof fields !== 'object') throw new Error('"fields" must be a JSON object.');
                logger.log(`[Salesforce] updateRecord ${objectType}/${recordId}`);
                await sf('PATCH', `/sobjects/${objectType}/${recordId}`, fields);
                return { output: { updated: true, objectType, recordId } };
            }

            case 'deleteRecord': {
                const objectType = String(inputs.objectType ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!objectType) throw new Error('"objectType" is required.');
                if (!recordId) throw new Error('"recordId" is required.');
                logger.log(`[Salesforce] deleteRecord ${objectType}/${recordId}`);
                await sf('DELETE', `/sobjects/${objectType}/${recordId}`);
                return { output: { deleted: true, objectType, recordId } };
            }

            case 'queryRecords': {
                const soql = String(inputs.soql ?? '').trim();
                if (!soql) throw new Error('"soql" is required.');
                logger.log(`[Salesforce] queryRecords`);
                const data = await sf('GET', `/query?q=${encodeURIComponent(soql)}`);
                return {
                    output: {
                        records: data.records ?? [],
                        totalSize: data.totalSize ?? 0,
                        done: data.done ?? true,
                        nextRecordsUrl: data.nextRecordsUrl ?? null,
                    },
                };
            }

            case 'searchRecords': {
                const sosl = String(inputs.sosl ?? '').trim();
                if (!sosl) throw new Error('"sosl" is required.');
                logger.log(`[Salesforce] searchRecords`);
                const data = await sf('GET', `/search?q=${encodeURIComponent(sosl)}`);
                return {
                    output: {
                        searchRecords: data.searchRecords ?? [],
                        count: (data.searchRecords ?? []).length,
                    },
                };
            }

            case 'getObjectFields': {
                const objectType = String(inputs.objectType ?? '').trim();
                if (!objectType) throw new Error('"objectType" is required.');
                logger.log(`[Salesforce] getObjectFields ${objectType}`);
                const data = await sf('GET', `/sobjects/${objectType}/describe`);
                const fields = (data.fields ?? []).map((f: any) => ({
                    name: f.name,
                    label: f.label,
                    type: f.type,
                    nillable: f.nillable,
                    updateable: f.updateable,
                    createable: f.createable,
                }));
                return { output: { objectType, fields, fieldCount: fields.length } };
            }

            case 'createLead': {
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const company = String(inputs.company ?? '').trim();
                if (!lastName) throw new Error('"lastName" is required.');
                if (!email) throw new Error('"email" is required.');
                if (!company) throw new Error('"company" is required.');
                const payload: any = { LastName: lastName, Email: email, Company: company };
                if (firstName) payload.FirstName = firstName;
                if (inputs.phone) payload.Phone = String(inputs.phone);
                logger.log(`[Salesforce] createLead ${email}`);
                const data = await sf('POST', '/sobjects/Lead', payload);
                return { output: { id: data.id, success: data.success, errors: data.errors ?? [] } };
            }

            case 'createContact': {
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!lastName) throw new Error('"lastName" is required.');
                if (!email) throw new Error('"email" is required.');
                const payload: any = { LastName: lastName, Email: email };
                if (firstName) payload.FirstName = firstName;
                if (inputs.accountId) payload.AccountId = String(inputs.accountId);
                logger.log(`[Salesforce] createContact ${email}`);
                const data = await sf('POST', '/sobjects/Contact', payload);
                return { output: { id: data.id, success: data.success, errors: data.errors ?? [] } };
            }

            case 'createOpportunity': {
                const name = String(inputs.name ?? '').trim();
                const accountId = String(inputs.accountId ?? '').trim();
                const closeDate = String(inputs.closeDate ?? '').trim();
                const stageName = String(inputs.stageName ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                if (!closeDate) throw new Error('"closeDate" is required (YYYY-MM-DD).');
                if (!stageName) throw new Error('"stageName" is required.');
                const payload: any = { Name: name, CloseDate: closeDate, StageName: stageName };
                if (accountId) payload.AccountId = accountId;
                if (inputs.amount !== undefined && inputs.amount !== '') payload.Amount = Number(inputs.amount);
                logger.log(`[Salesforce] createOpportunity "${name}"`);
                const data = await sf('POST', '/sobjects/Opportunity', payload);
                return { output: { id: data.id, success: data.success, errors: data.errors ?? [] } };
            }

            case 'upsertRecord': {
                const objectType = String(inputs.objectType ?? '').trim();
                const externalIdField = String(inputs.externalIdField ?? '').trim();
                const externalId = String(inputs.externalId ?? '').trim();
                if (!objectType) throw new Error('"objectType" is required.');
                if (!externalIdField) throw new Error('"externalIdField" is required.');
                if (!externalId) throw new Error('"externalId" is required.');
                const fields = parseJson(inputs.fields, 'fields');
                if (!fields || typeof fields !== 'object') throw new Error('"fields" must be a JSON object.');
                logger.log(`[Salesforce] upsertRecord ${objectType} by ${externalIdField}=${externalId}`);
                const data = await sf('PATCH', `/sobjects/${objectType}/${externalIdField}/${externalId}`, fields);
                // PATCH upsert returns 201 (created) or 204 (updated); sfFetch returns { success: true } for 204
                const id = data?.id ?? null;
                const created = data?.created ?? (id !== null);
                return { output: { id, created, success: true } };
            }

            default:
                return { error: `Salesforce action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e.message || 'Salesforce action failed.';
        logger.log(`[Salesforce] Error in "${actionName}": ${msg}`);
        return { error: msg };
    }
}
