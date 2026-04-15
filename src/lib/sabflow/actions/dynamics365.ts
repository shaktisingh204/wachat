'use server';

export async function executeDynamics365Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        let accessToken = inputs.accessToken;

        // Acquire token via client_credentials if not provided
        if (!accessToken && inputs.tenantId && inputs.clientId && inputs.clientSecret) {
            const resource = inputs.resource || `https://${inputs.orgUrl}/`;
            const params = new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: inputs.clientId,
                client_secret: inputs.clientSecret,
                scope: inputs.scope || `${resource}.default`,
            });
            const tokenRes = await fetch(
                `https://login.microsoftonline.com/${inputs.tenantId}/oauth2/v2.0/token`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                }
            );
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok) throw new Error(tokenData.error_description || 'D365 token fetch failed');
            accessToken = tokenData.access_token;
        }

        if (!accessToken) throw new Error('Missing accessToken or client_credentials');
        if (!inputs.orgUrl) throw new Error('Missing orgUrl');

        const base = `https://${inputs.orgUrl}/api/data/v9.2`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
        };

        switch (actionName) {
            case 'listRecords': {
                const { entitySetName, select, filter, orderby, top, expand } = inputs;
                const params = new URLSearchParams();
                if (select) params.set('$select', select);
                if (filter) params.set('$filter', filter);
                if (orderby) params.set('$orderby', orderby);
                if (top) params.set('$top', String(top));
                if (expand) params.set('$expand', expand);
                const res = await fetch(`${base}/${entitySetName}?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data };
            }
            case 'getRecord': {
                const { entitySetName, id, select, expand } = inputs;
                const params = new URLSearchParams();
                if (select) params.set('$select', select);
                if (expand) params.set('$expand', expand);
                const qs = params.toString();
                const res = await fetch(`${base}/${entitySetName}(${id})${qs ? '?' + qs : ''}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data };
            }
            case 'createRecord': {
                const { entitySetName, record } = inputs;
                const res = await fetch(`${base}/${entitySetName}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(record),
                });
                const text = await res.text();
                if (!res.ok) {
                    const errData = text ? JSON.parse(text) : {};
                    throw new Error(errData?.error?.message || text || 'Create failed');
                }
                const data = text ? JSON.parse(text) : { success: true };
                return { output: data };
            }
            case 'updateRecord': {
                const { entitySetName, id, record } = inputs;
                const res = await fetch(`${base}/${entitySetName}(${id})`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(record),
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data };
            }
            case 'deleteRecord': {
                const { entitySetName, id } = inputs;
                const res = await fetch(`${base}/${entitySetName}(${id})`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data };
            }
            case 'searchRecords': {
                const { searchTerm, entities, top } = inputs;
                const res = await fetch(`${base}/Search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ search: searchTerm, entities, top }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data };
            }
            case 'executeAction': {
                const { actionName: d365Action, parameters, boundEntitySetName, boundId } = inputs;
                const url = boundEntitySetName && boundId
                    ? `${base}/${boundEntitySetName}(${boundId})/Microsoft.Dynamics.CRM.${d365Action}`
                    : `${base}/${d365Action}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(parameters || {}),
                });
                const text = await res.text();
                const data = text ? JSON.parse(text) : { success: true };
                if (!res.ok) throw new Error(data?.error?.message || text);
                return { output: data };
            }
            case 'executeBatch': {
                const { requests } = inputs;
                const boundary = `batch_${Date.now()}`;
                let batchBody = '';
                for (const req of requests) {
                    batchBody += `--${boundary}\r\nContent-Type: application/http\r\nContent-Transfer-Encoding: binary\r\n\r\n`;
                    batchBody += `${req.method} ${base}/${req.path} HTTP/1.1\r\n`;
                    if (req.body) {
                        batchBody += `Content-Type: application/json\r\n\r\n${JSON.stringify(req.body)}\r\n`;
                    } else {
                        batchBody += '\r\n';
                    }
                }
                batchBody += `--${boundary}--`;
                const batchHeaders = {
                    ...headers,
                    'Content-Type': `multipart/mixed; boundary=${boundary}`,
                };
                const res = await fetch(`${base}/$batch`, {
                    method: 'POST',
                    headers: batchHeaders,
                    body: batchBody,
                });
                const text = await res.text();
                if (!res.ok) throw new Error(text);
                return { output: { response: text } };
            }
            case 'getEntityMetadata': {
                const { logicalName } = inputs;
                const res = await fetch(`${base}/EntityDefinitions(LogicalName='${logicalName}')`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data };
            }
            case 'listEntityMetadata': {
                const res = await fetch(`${base}/EntityDefinitions`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data };
            }
            case 'createRelationship': {
                const { relationshipDefinition } = inputs;
                const res = await fetch(`${base}/RelationshipDefinitions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(relationshipDefinition),
                });
                const text = await res.text();
                const data = text ? JSON.parse(text) : { success: true };
                if (!res.ok) throw new Error(data?.error?.message || text);
                return { output: data };
            }
            case 'associateRecords': {
                const { entitySetName, id, relatedEntitySetName, relatedId, navigationProperty } = inputs;
                const body = { '@odata.id': `${base}/${relatedEntitySetName}(${relatedId})` };
                const res = await fetch(`${base}/${entitySetName}(${id})/${navigationProperty}/$ref`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data };
            }
            case 'disassociateRecords': {
                const { entitySetName, id, navigationProperty, relatedId } = inputs;
                const url = relatedId
                    ? `${base}/${entitySetName}(${id})/${navigationProperty}(${relatedId})/$ref`
                    : `${base}/${entitySetName}(${id})/${navigationProperty}/$ref`;
                const res = await fetch(url, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data };
            }
            case 'exportToExcel': {
                const { entitySetName, filter, select } = inputs;
                const params = new URLSearchParams();
                if (filter) params.set('$filter', filter);
                if (select) params.set('$select', select);
                const excelHeaders = { ...headers, Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
                const res = await fetch(`${base}/${entitySetName}?${params.toString()}`, { headers: excelHeaders });
                if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
                const buffer = await res.arrayBuffer();
                const b64 = Buffer.from(buffer).toString('base64');
                return { output: { base64: b64, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } };
            }
            case 'importFromCsv': {
                const { entitySetName, csvContent } = inputs;
                // Use ImportMaps / import job approach via action
                const res = await fetch(`${base}/ImportFiles`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ content: Buffer.from(csvContent).toString('base64'), name: `${entitySetName}.csv` }),
                });
                const text = await res.text();
                const data = text ? JSON.parse(text) : { success: true };
                if (!res.ok) throw new Error(data?.error?.message || text);
                return { output: data };
            }
            default:
                throw new Error(`Unknown Dynamics 365 action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`Dynamics365 error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
