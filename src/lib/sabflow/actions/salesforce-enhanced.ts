'use server';

export async function executeSalesforceEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        // Resolve access token — either provided directly or fetched via OAuth2
        let accessToken = inputs.accessToken;
        let instanceUrl = inputs.instanceUrl;

        if (!accessToken && inputs.clientId && inputs.clientSecret && inputs.username && inputs.password) {
            const params = new URLSearchParams({
                grant_type: 'password',
                client_id: inputs.clientId,
                client_secret: inputs.clientSecret,
                username: inputs.username,
                password: inputs.password + (inputs.securityToken || ''),
            });
            const tokenRes = await fetch('https://login.salesforce.com/services/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok) throw new Error(tokenData.error_description || 'OAuth2 token fetch failed');
            accessToken = tokenData.access_token;
            instanceUrl = tokenData.instance_url;
        }

        if (!accessToken) throw new Error('Missing accessToken or OAuth2 credentials');
        if (!instanceUrl) throw new Error('Missing instanceUrl');

        const base = `${instanceUrl}/services/data/v57.0`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'query': {
                const soql = encodeURIComponent(inputs.query);
                const res = await fetch(`${base}/query?q=${soql}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'getObject':
            case 'describeObject': {
                const object = inputs.objectName || inputs.object;
                const res = await fetch(`${base}/sobjects/${object}/describe`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'listObjects': {
                const res = await fetch(`${base}/sobjects`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'getRecord':
            case 'getObject_byId': {
                const { objectName, recordId, fields } = inputs;
                const fieldParam = fields ? `?fields=${encodeURIComponent(fields)}` : '';
                const res = await fetch(`${base}/sobjects/${objectName}/${recordId}${fieldParam}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'createObject':
            case 'createRecord': {
                const { objectName, record, fields: body } = inputs;
                const payload = record || body || inputs.body;
                const res = await fetch(`${base}/sobjects/${objectName}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'updateObject':
            case 'updateRecord': {
                const { objectName, recordId, record, fields: body } = inputs;
                const payload = record || body || inputs.body;
                const res = await fetch(`${base}/sobjects/${objectName}/${recordId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(payload),
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'deleteObject':
            case 'deleteRecord': {
                const { objectName, recordId } = inputs;
                const res = await fetch(`${base}/sobjects/${objectName}/${recordId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'upsertObject':
            case 'upsertRecord': {
                const { objectName, externalIdField, externalIdValue, record } = inputs;
                const res = await fetch(`${base}/sobjects/${objectName}/${externalIdField}/${externalIdValue}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(record),
                });
                const text = await res.text();
                const data = text ? JSON.parse(text) : { success: true };
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'search': {
                const sosl = encodeURIComponent(inputs.query);
                const res = await fetch(`${base}/search?q=${sosl}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'bulkCreate': {
                const { objectName, records } = inputs;
                // Use Composite sObject Collections API
                const res = await fetch(`${base}/composite/sobjects`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        allOrNone: inputs.allOrNone ?? false,
                        records: records.map((r: any) => ({
                            attributes: { type: objectName },
                            ...r,
                        })),
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'getRecentItems': {
                const res = await fetch(`${base}/recent`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            default:
                throw new Error(`Unknown Salesforce Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`SalesforceEnhanced error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
