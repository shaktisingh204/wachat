'use server';

export async function executeGoogleSecretManagerAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, projectId, secretId, versionId } = inputs;
    const base = 'https://secretmanager.googleapis.com/v1';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
    const parentPath = `projects/${projectId}`;
    const secretPath = `projects/${projectId}/secrets/${secretId}`;
    const versionPath = `projects/${projectId}/secrets/${secretId}/versions/${versionId || 'latest'}`;

    try {
        switch (actionName) {
            case 'listSecrets': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.filter) params.set('filter', inputs.filter);
                const res = await fetch(`${base}/${parentPath}/secrets?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listSecrets failed' };
                return { output: data };
            }
            case 'createSecret': {
                const body: any = {
                    replication: inputs.replication || { automatic: {} },
                };
                if (inputs.labels) body.labels = inputs.labels;
                if (inputs.annotations) body.annotations = inputs.annotations;
                if (inputs.expireTime) body.expireTime = inputs.expireTime;
                if (inputs.ttl) body.ttl = inputs.ttl;
                const params = new URLSearchParams({ secretId });
                const res = await fetch(`${base}/${parentPath}/secrets?${params}`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createSecret failed' };
                return { output: data };
            }
            case 'getSecret': {
                const res = await fetch(`${base}/${secretPath}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getSecret failed' };
                return { output: data };
            }
            case 'updateSecret': {
                const body: any = {};
                if (inputs.labels !== undefined) body.labels = inputs.labels;
                if (inputs.annotations !== undefined) body.annotations = inputs.annotations;
                if (inputs.expireTime !== undefined) body.expireTime = inputs.expireTime;
                if (inputs.ttl !== undefined) body.ttl = inputs.ttl;
                const updateMask = inputs.updateMask || Object.keys(body).join(',');
                const params = new URLSearchParams({ updateMask });
                const res = await fetch(`${base}/${secretPath}?${params}`, {
                    method: 'PATCH', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'updateSecret failed' };
                return { output: data };
            }
            case 'deleteSecret': {
                const res = await fetch(`${base}/${secretPath}`, { method: 'DELETE', headers });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.error?.message || 'deleteSecret failed' };
            }
            case 'addSecretVersion': {
                const secretValue = inputs.secretValue || inputs.payload || '';
                const payloadData = Buffer.from(secretValue).toString('base64');
                const body = {
                    payload: {
                        data: payloadData,
                        dataCrc32c: inputs.dataCrc32c,
                    },
                };
                const res = await fetch(`${base}/${secretPath}:addVersion`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'addSecretVersion failed' };
                return { output: data };
            }
            case 'getSecretVersion': {
                const res = await fetch(`${base}/${versionPath}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getSecretVersion failed' };
                return { output: data };
            }
            case 'listSecretVersions': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.filter) params.set('filter', inputs.filter);
                const res = await fetch(`${base}/${secretPath}/versions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listSecretVersions failed' };
                return { output: data };
            }
            case 'accessSecretVersion': {
                const res = await fetch(`${base}/${versionPath}:access`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'accessSecretVersion failed' };
                const decoded = data.payload?.data
                    ? Buffer.from(data.payload.data, 'base64').toString('utf-8')
                    : null;
                return { output: { ...data, decodedValue: decoded } };
            }
            case 'destroySecretVersion': {
                const res = await fetch(`${base}/${versionPath}:destroy`, {
                    method: 'POST', headers, body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'destroySecretVersion failed' };
                return { output: data };
            }
            case 'enableSecretVersion': {
                const res = await fetch(`${base}/${versionPath}:enable`, {
                    method: 'POST', headers, body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'enableSecretVersion failed' };
                return { output: data };
            }
            case 'disableSecretVersion': {
                const res = await fetch(`${base}/${versionPath}:disable`, {
                    method: 'POST', headers, body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'disableSecretVersion failed' };
                return { output: data };
            }
            case 'setIamPolicy': {
                const body = { policy: inputs.policy || {}, updateMask: inputs.updateMask };
                const res = await fetch(`${base}/${secretPath}:setIamPolicy`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'setIamPolicy failed' };
                return { output: data };
            }
            case 'getIamPolicy': {
                const res = await fetch(`${base}/${secretPath}:getIamPolicy`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getIamPolicy failed' };
                return { output: data };
            }
            case 'testIamPermissions': {
                const permissions = inputs.permissions || [];
                const body = { permissions: Array.isArray(permissions) ? permissions : [permissions] };
                const res = await fetch(`${base}/${secretPath}:testIamPermissions`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'testIamPermissions failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown Secret Manager action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Secret Manager action error: ${err.message}`);
        return { error: err.message || 'Secret Manager action failed' };
    }
}
