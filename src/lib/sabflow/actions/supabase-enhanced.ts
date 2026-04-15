'use server';

export async function executeSupabaseEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const projectBase = `https://${inputs.projectId}.supabase.co`;
        const mgmtBase = 'https://api.supabase.com/v1';
        const authKey = inputs.serviceRoleKey || inputs.anonKey;

        const restRequest = async (method: string, path: string, body?: any, params?: Record<string, string>) => {
            let url = `${projectBase}/rest/v1/${path}`;
            if (params && Object.keys(params).length > 0) {
                url += '?' + new URLSearchParams(params).toString();
            }
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': inputs.anonKey,
                    'Authorization': `Bearer ${authKey}`,
                    'Prefer': inputs.prefer || (method === 'POST' ? 'return=representation' : ''),
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.hint || JSON.stringify(data));
            return data;
        };

        const storageRequest = async (method: string, path: string, body?: any, isJson = true) => {
            const res = await fetch(`${projectBase}/storage/v1/${path}`, {
                method,
                headers: {
                    ...(isJson ? { 'Content-Type': 'application/json' } : {}),
                    'apikey': inputs.anonKey,
                    'Authorization': `Bearer ${authKey}`,
                },
                body: body !== undefined ? (isJson ? JSON.stringify(body) : body) : undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || JSON.stringify(data));
            return data;
        };

        const mgmtRequest = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${mgmtBase}${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${inputs.accessToken || inputs.serviceRoleKey}`,
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || JSON.stringify(data));
            return data;
        };

        const buildQueryParams = (): Record<string, string> => {
            const params: Record<string, string> = {};
            if (inputs.select) params['select'] = inputs.select;
            if (inputs.filter) {
                const filterEntries = typeof inputs.filter === 'string'
                    ? JSON.parse(inputs.filter)
                    : inputs.filter;
                for (const [col, val] of Object.entries(filterEntries as Record<string, any>)) {
                    params[col] = `eq.${val}`;
                }
            }
            if (inputs.order) params['order'] = inputs.order;
            if (inputs.limit) params['limit'] = String(inputs.limit);
            if (inputs.offset) params['offset'] = String(inputs.offset);
            return params;
        };

        switch (actionName) {
            case 'select': {
                const data = await restRequest('GET', inputs.table, undefined, buildQueryParams());
                return { output: { rows: data } };
            }
            case 'insert': {
                const data = await restRequest('POST', inputs.table, inputs.record || inputs.records);
                return { output: { result: data } };
            }
            case 'update': {
                const data = await restRequest('PATCH', inputs.table, inputs.record, buildQueryParams());
                return { output: { result: data } };
            }
            case 'upsert': {
                const data = await restRequest('POST', inputs.table, inputs.record, buildQueryParams());
                return { output: { result: data } };
            }
            case 'delete': {
                const data = await restRequest('DELETE', inputs.table, undefined, buildQueryParams());
                return { output: { result: data } };
            }
            case 'rpc': {
                const data = await restRequest('POST', `rpc/${inputs.functionName}`, inputs.args || {});
                return { output: { result: data } };
            }
            case 'listProjects': {
                const data = await mgmtRequest('GET', '/projects');
                return { output: { projects: data } };
            }
            case 'getProject': {
                const data = await mgmtRequest('GET', `/projects/${inputs.projectRef}`);
                return { output: data };
            }
            case 'createProject': {
                const data = await mgmtRequest('POST', '/projects', {
                    name: inputs.name,
                    organization_id: inputs.organizationId,
                    plan: inputs.plan || 'free',
                    region: inputs.region || 'us-east-1',
                    db_pass: inputs.dbPassword,
                });
                return { output: data };
            }
            case 'listOrganizations': {
                const data = await mgmtRequest('GET', '/organizations');
                return { output: { organizations: data } };
            }
            case 'getBuckets': {
                const data = await storageRequest('GET', 'bucket');
                return { output: { buckets: data } };
            }
            case 'createBucket': {
                const data = await storageRequest('POST', 'bucket', {
                    id: inputs.bucketId || inputs.bucketName,
                    name: inputs.bucketName,
                    public: inputs.public || false,
                    allowed_mime_types: inputs.allowedMimeTypes,
                    file_size_limit: inputs.fileSizeLimit,
                });
                return { output: data };
            }
            case 'uploadFile': {
                const fileContent = inputs.fileContent;
                const res = await fetch(`${projectBase}/storage/v1/object/${inputs.bucketId}/${inputs.filePath}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': inputs.contentType || 'application/octet-stream',
                        'apikey': inputs.anonKey,
                        'Authorization': `Bearer ${authKey}`,
                    },
                    body: fileContent,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || JSON.stringify(data));
                return { output: data };
            }
            case 'downloadFile': {
                const res = await fetch(`${projectBase}/storage/v1/object/${inputs.bucketId}/${inputs.filePath}`, {
                    headers: {
                        'apikey': inputs.anonKey,
                        'Authorization': `Bearer ${authKey}`,
                    },
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.message || JSON.stringify(data));
                }
                const publicUrl = `${projectBase}/storage/v1/object/public/${inputs.bucketId}/${inputs.filePath}`;
                return { output: { url: publicUrl, status: res.status } };
            }
            case 'deleteFile': {
                const data = await storageRequest('DELETE', `object/${inputs.bucketId}`, {
                    prefixes: Array.isArray(inputs.filePaths) ? inputs.filePaths : [inputs.filePath],
                });
                return { output: data };
            }
            case 'listFiles': {
                const data = await storageRequest('POST', `object/list/${inputs.bucketId}`, {
                    prefix: inputs.prefix || '',
                    limit: inputs.limit || 100,
                    offset: inputs.offset || 0,
                    sortBy: inputs.sortBy || { column: 'name', order: 'asc' },
                });
                return { output: { files: data } };
            }
            default:
                return { error: `Unknown Supabase Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Supabase Enhanced action error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
