'use server';

export async function executeServiceNowEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const instance = inputs.instance; // e.g. "mycompany"
        if (!instance) throw new Error('Missing instance');

        const base = `https://${instance}.service-now.com/api`;

        let authHeader: string;
        if (inputs.accessToken) {
            authHeader = `Bearer ${inputs.accessToken}`;
        } else {
            const creds = `${inputs.username}:${inputs.password}`;
            authHeader = `Basic ${Buffer.from(creds).toString('base64')}`;
        }

        const headers: Record<string, string> = {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const tableBase = `${base}/now/table`;

        switch (actionName) {
            case 'getRecord': {
                const { tableName, sysId } = inputs;
                const res = await fetch(`${tableBase}/${tableName}/${sysId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'createRecord': {
                const { tableName, record } = inputs;
                const res = await fetch(`${tableBase}/${tableName}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(record),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'updateRecord': {
                const { tableName, sysId, record } = inputs;
                const res = await fetch(`${tableBase}/${tableName}/${sysId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(record),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'deleteRecord': {
                const { tableName, sysId } = inputs;
                const res = await fetch(`${tableBase}/${tableName}/${sysId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data };
            }
            case 'queryTable': {
                const { tableName, query, limit, offset } = inputs;
                const params = new URLSearchParams();
                if (query) params.set('sysparm_query', query);
                if (limit) params.set('sysparm_limit', String(limit));
                if (offset) params.set('sysparm_offset', String(offset));
                const res = await fetch(`${tableBase}/${tableName}?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'getIncident': {
                const { sysId, number } = inputs;
                if (sysId) {
                    const res = await fetch(`${tableBase}/incident/${sysId}`, { headers });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                    return { output: data.result };
                }
                const params = new URLSearchParams({ sysparm_query: `number=${number}` });
                const res = await fetch(`${tableBase}/incident?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result?.[0] || null };
            }
            case 'createIncident': {
                const res = await fetch(`${tableBase}/incident`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.record || inputs),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'updateIncident': {
                const { sysId, record } = inputs;
                const res = await fetch(`${tableBase}/incident/${sysId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(record),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'getChangeRequest': {
                const { sysId } = inputs;
                const res = await fetch(`${tableBase}/change_request/${sysId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'createChangeRequest': {
                const res = await fetch(`${tableBase}/change_request`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.record || inputs),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'getProblem': {
                const { sysId } = inputs;
                const res = await fetch(`${tableBase}/problem/${sysId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'createProblem': {
                const res = await fetch(`${tableBase}/problem`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.record || inputs),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'runScript': {
                const res = await fetch(`${base}/now/script/run`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ script: inputs.script }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'getCatalogItem': {
                const { sysId } = inputs;
                const res = await fetch(`${base}/sn_sc/servicecatalog/items/${sysId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            case 'orderCatalogItem': {
                const { sysId, quantity, variables } = inputs;
                const res = await fetch(`${base}/sn_sc/servicecatalog/items/${sysId}/order_now`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ quantity: quantity || 1, variables: variables || {} }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
                return { output: data.result };
            }
            default:
                throw new Error(`Unknown ServiceNow Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`ServiceNowEnhanced error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
