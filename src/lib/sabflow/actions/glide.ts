'use server';

export async function executeGlideAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = 'https://api.glideapp.io';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.apiKey}`,
            'Content-Type': 'application/json',
        };

        const postMutation = async (type: string, payload: Record<string, any>) => {
            const body = {
                appID: inputs.appId,
                mutations: [{ kind: type, ...payload }],
            };
            const res = await fetch(`${baseUrl}/api/container/columns/query`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) return { ok: false, data, status: res.status };
            return { ok: true, data };
        };

        switch (actionName) {
            case 'addRow': {
                const result = await postMutation('add-row', {
                    tableName: inputs.tableName,
                    columnValues: inputs.columnValues || {},
                });
                if (!result.ok) return { error: result.data?.message || `Failed to add row: ${result.status}` };
                return { output: result.data };
            }

            case 'updateRow': {
                const result = await postMutation('set-columns-in-row', {
                    tableName: inputs.tableName,
                    rowID: inputs.rowId || inputs.rowID,
                    columnValues: inputs.columnValues || {},
                });
                if (!result.ok) return { error: result.data?.message || `Failed to update row: ${result.status}` };
                return { output: result.data };
            }

            case 'deleteRow': {
                const result = await postMutation('delete-row', {
                    tableName: inputs.tableName,
                    rowID: inputs.rowId || inputs.rowID,
                });
                if (!result.ok) return { error: result.data?.message || `Failed to delete row: ${result.status}` };
                return { output: result.data };
            }

            case 'getRows': {
                const body: any = {
                    appID: inputs.appId,
                    queries: [{ tableName: inputs.tableName }],
                };
                const res = await fetch(`${baseUrl}/api/container/columns/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get rows: ${res.status}` };
                return { output: data };
            }

            case 'queryDatabase': {
                const body: any = {
                    appID: inputs.appId,
                    queries: inputs.queries || [{ tableName: inputs.tableName }],
                };
                const res = await fetch(`${baseUrl}/api/container/columns/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to query database: ${res.status}` };
                return { output: data };
            }

            case 'getApp': {
                const body = {
                    appID: inputs.appId,
                    mutations: [{ kind: 'get-app-info' }],
                };
                const res = await fetch(`${baseUrl}/api/container/columns/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get app: ${res.status}` };
                return { output: data };
            }

            case 'listApps': {
                const res = await fetch(`${baseUrl}/api/apps`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list apps: ${res.status}` };
                return { output: data };
            }

            case 'uploadFile': {
                // Step 1: Get a signed upload URL
                const signRes = await fetch(`${baseUrl}/api/file/sign`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        appID: inputs.appId,
                        filename: inputs.filename,
                        contentType: inputs.contentType || 'application/octet-stream',
                    }),
                });
                const signData = await signRes.json();
                if (!signRes.ok) return { error: signData?.message || `Failed to get signed URL: ${signRes.status}` };

                const { uploadUrl, fileUrl } = signData;

                // Step 2: Upload to signed URL
                const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': inputs.contentType || 'application/octet-stream' },
                    body: inputs.fileContent,
                });
                if (!uploadRes.ok) return { error: `Failed to upload file to signed URL: ${uploadRes.status}` };

                return { output: { fileUrl, uploadUrl } };
            }

            case 'sendPushNotification': {
                const result = await postMutation('send-push-notification', {
                    tableName: inputs.tableName,
                    rowID: inputs.rowId || inputs.rowID,
                    title: inputs.title,
                    body: inputs.body,
                });
                if (!result.ok) return { error: result.data?.message || `Failed to send push notification: ${result.status}` };
                return { output: result.data };
            }

            case 'listTables': {
                const res = await fetch(`${baseUrl}/api/apps`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list tables: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Glide action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Glide action error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in Glide action.' };
    }
}
