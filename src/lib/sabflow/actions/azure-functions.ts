'use server';

export async function executeAzureFunctionsAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const functionKey = inputs.functionKey;
    const subscriptionId = inputs.subscriptionId;
    const resourceGroup = inputs.resourceGroup;
    const functionAppName = inputs.functionAppName;

    const mgmtBase = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Web/sites/${functionAppName}`;
    const apiVersion = inputs.apiVersion || '2022-03-01';

    function mgmtHeaders(): Record<string, string> {
        return {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };
    }

    function functionInvokeHeaders(): Record<string, string> {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (functionKey) h['x-functions-key'] = functionKey;
        return h;
    }

    try {
        switch (actionName) {
            case 'listFunctions': {
                const url = `${mgmtBase}/functions?api-version=${apiVersion}`;
                const res = await fetch(url, { headers: mgmtHeaders() });
                const data = await res.json();
                return { output: { status: res.status, functions: data } };
            }

            case 'getFunction': {
                const functionName = inputs.functionName;
                const url = `${mgmtBase}/functions/${functionName}?api-version=${apiVersion}`;
                const res = await fetch(url, { headers: mgmtHeaders() });
                const data = await res.json();
                return { output: { status: res.status, function: data } };
            }

            case 'invokeFunction': {
                const functionName = inputs.functionName;
                const hostname = inputs.hostname || `${functionAppName}.azurewebsites.net`;
                const url = `https://${hostname}/api/${functionName}`;
                const res = await fetch(url, { headers: functionInvokeHeaders() });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            case 'invokeFunctionWithBody': {
                const functionName = inputs.functionName;
                const hostname = inputs.hostname || `${functionAppName}.azurewebsites.net`;
                const body = inputs.body || {};
                const url = `https://${hostname}/api/${functionName}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: functionInvokeHeaders(),
                    body: typeof body === 'string' ? body : JSON.stringify(body),
                });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            case 'listFunctionApps': {
                const subBase = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Web/sites`;
                const url = `${subBase}?api-version=${apiVersion}`;
                const res = await fetch(url, { headers: mgmtHeaders() });
                const data = await res.json();
                return { output: { status: res.status, functionApps: data } };
            }

            case 'getFunctionApp': {
                const url = `${mgmtBase}?api-version=${apiVersion}`;
                const res = await fetch(url, { headers: mgmtHeaders() });
                const data = await res.json();
                return { output: { status: res.status, functionApp: data } };
            }

            case 'createFunctionApp': {
                const location = inputs.location || 'eastus';
                const url = `${mgmtBase}?api-version=${apiVersion}`;
                const body = {
                    location,
                    kind: 'functionapp',
                    properties: inputs.properties || {},
                };
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: mgmtHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, functionApp: data } };
            }

            case 'restartFunctionApp': {
                const url = `${mgmtBase}/restart?api-version=${apiVersion}`;
                const res = await fetch(url, { method: 'POST', headers: mgmtHeaders() });
                return { output: { status: res.status, restarted: res.ok } };
            }

            case 'getFunctionAppSettings': {
                const url = `${mgmtBase}/config/appsettings/list?api-version=${apiVersion}`;
                const res = await fetch(url, { method: 'POST', headers: mgmtHeaders() });
                const data = await res.json();
                return { output: { status: res.status, settings: data } };
            }

            case 'updateFunctionAppSettings': {
                const url = `${mgmtBase}/config/appsettings?api-version=${apiVersion}`;
                const body = { properties: inputs.settings || {} };
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: mgmtHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, settings: data } };
            }

            case 'listTriggers': {
                const functionName = inputs.functionName;
                const url = `${mgmtBase}/functions/${functionName}/triggers?api-version=${apiVersion}`;
                const res = await fetch(url, { headers: mgmtHeaders() });
                const data = await res.json();
                return { output: { status: res.status, triggers: data } };
            }

            case 'getKeys': {
                const functionName = inputs.functionName;
                const url = `${mgmtBase}/functions/${functionName}/listkeys?api-version=${apiVersion}`;
                const res = await fetch(url, { method: 'POST', headers: mgmtHeaders() });
                const data = await res.json();
                return { output: { status: res.status, keys: data } };
            }

            case 'createKey': {
                const functionName = inputs.functionName;
                const keyName = inputs.keyName;
                const keyValue = inputs.keyValue || '';
                const url = `${mgmtBase}/functions/${functionName}/keys/${keyName}?api-version=${apiVersion}`;
                const body = { properties: { value: keyValue } };
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: mgmtHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, key: data } };
            }

            case 'deleteKey': {
                const functionName = inputs.functionName;
                const keyName = inputs.keyName;
                const url = `${mgmtBase}/functions/${functionName}/keys/${keyName}?api-version=${apiVersion}`;
                const res = await fetch(url, { method: 'DELETE', headers: mgmtHeaders() });
                return { output: { status: res.status, deleted: res.ok } };
            }

            case 'getHostStatus': {
                const hostname = inputs.hostname || `${functionAppName}.azurewebsites.net`;
                const url = `https://${hostname}/admin/host/status`;
                const res = await fetch(url, { headers: functionInvokeHeaders() });
                const data = await res.json();
                return { output: { status: res.status, hostStatus: data } };
            }

            default:
                return { error: `Unknown Azure Functions action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Azure Functions action error: ${err.message}`);
        return { error: err.message || 'Azure Functions action failed' };
    }
}
