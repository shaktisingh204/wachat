'use server';

export async function executeGoogleCloudFunctionsAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, projectId, location, functionName, operationName } = inputs;
    const base = 'https://cloudfunctions.googleapis.com/v2';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
    const parentPath = `projects/${projectId}/locations/${location || '-'}`;
    const functionPath = `projects/${projectId}/locations/${location}/functions/${functionName}`;

    try {
        switch (actionName) {
            case 'listFunctions': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.filter) params.set('filter', inputs.filter);
                const res = await fetch(`${base}/${parentPath}/functions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listFunctions failed' };
                return { output: data };
            }
            case 'getFunction': {
                const res = await fetch(`${base}/${functionPath}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getFunction failed' };
                return { output: data };
            }
            case 'createFunction': {
                const body: any = {
                    name: functionPath,
                    environment: inputs.environment || 'GEN_2',
                };
                if (inputs.buildConfig) body.buildConfig = inputs.buildConfig;
                if (inputs.serviceConfig) body.serviceConfig = inputs.serviceConfig;
                if (inputs.description) body.description = inputs.description;
                if (inputs.labels) body.labels = inputs.labels;
                const params = new URLSearchParams({ functionId: functionName });
                const res = await fetch(`${base}/projects/${projectId}/locations/${location}/functions?${params}`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createFunction failed' };
                return { output: data };
            }
            case 'updateFunction': {
                const body: any = inputs.functionBody || {};
                const updateMask = inputs.updateMask || 'serviceConfig';
                const params = new URLSearchParams({ updateMask });
                const res = await fetch(`${base}/${functionPath}?${params}`, {
                    method: 'PATCH', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'updateFunction failed' };
                return { output: data };
            }
            case 'deleteFunction': {
                const res = await fetch(`${base}/${functionPath}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'deleteFunction failed' };
                return { output: data };
            }
            case 'callFunction': {
                const body = { data: inputs.data !== undefined ? JSON.stringify(inputs.data) : '' };
                // For Gen 2, invoke via the service URL if provided
                if (inputs.serviceUrl) {
                    const invokeRes = await fetch(inputs.serviceUrl, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(inputs.data || {}),
                    });
                    const text = await invokeRes.text();
                    return { output: { result: text, statusCode: invokeRes.status } };
                }
                // For Gen 1 legacy call
                const res = await fetch(`${base}/${functionPath}:call`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'callFunction failed' };
                return { output: data };
            }
            case 'generateUploadUrl': {
                const body: any = {};
                if (inputs.environment) body.environment = inputs.environment;
                const res = await fetch(`${base}/projects/${projectId}/locations/${location}/functions:generateUploadUrl`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'generateUploadUrl failed' };
                return { output: data };
            }
            case 'generateDownloadUrl': {
                const res = await fetch(`${base}/${functionPath}:generateDownloadUrl`, {
                    method: 'POST', headers, body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'generateDownloadUrl failed' };
                return { output: data };
            }
            case 'listOperations': {
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${base}/projects/${projectId}/locations/${location}/operations?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listOperations failed' };
                return { output: data };
            }
            case 'getOperation': {
                const opName = operationName || inputs.name;
                const res = await fetch(`${base}/${opName}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getOperation failed' };
                return { output: data };
            }
            case 'listRuntimes': {
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', inputs.filter);
                const res = await fetch(`${base}/projects/${projectId}/locations/${location}/runtimes?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listRuntimes failed' };
                return { output: data };
            }
            case 'setIamPolicy': {
                const body = { policy: inputs.policy || {}, updateMask: inputs.updateMask };
                const res = await fetch(`${base}/${functionPath}:setIamPolicy`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'setIamPolicy failed' };
                return { output: data };
            }
            case 'getIamPolicy': {
                const res = await fetch(`${base}/${functionPath}:getIamPolicy`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getIamPolicy failed' };
                return { output: data };
            }
            case 'listLocations': {
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${base}/projects/${projectId}/locations?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listLocations failed' };
                return { output: data };
            }
            case 'getFunctionLog': {
                // Use Cloud Logging API to fetch function logs
                const logBase = 'https://logging.googleapis.com/v2/entries:list';
                const filter = `resource.type="cloud_run_revision" resource.labels.service_name="${functionName}"`;
                const body: any = {
                    resourceNames: [`projects/${projectId}`],
                    filter: inputs.logFilter || filter,
                    orderBy: 'timestamp desc',
                    pageSize: Number(inputs.pageSize) || 50,
                };
                const res = await fetch(logBase, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getFunctionLog failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown Cloud Functions action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Cloud Functions action error: ${err.message}`);
        return { error: err.message || 'Cloud Functions action failed' };
    }
}
