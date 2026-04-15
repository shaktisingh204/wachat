'use server';

export async function executeNangoAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.nango.dev';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${inputs.secretKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listConnections': {
                const params = new URLSearchParams();
                if (inputs.integrationId) params.set('integration_id', inputs.integrationId);
                const res = await fetch(`${baseUrl}/connection?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list connections' };
                return { output: data };
            }
            case 'getConnection': {
                const params = new URLSearchParams();
                if (inputs.forceRefresh) params.set('force_refresh', String(inputs.forceRefresh));
                const res = await fetch(`${baseUrl}/connection/${inputs.connectionId}?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get connection' };
                return { output: data };
            }
            case 'createConnection': {
                const body: Record<string, any> = {
                    provider_config_key: inputs.providerConfigKey,
                    connection_id: inputs.connectionId,
                };
                if (inputs.credentials) body.credentials = inputs.credentials;
                if (inputs.connectionConfig) body.connection_config = inputs.connectionConfig;
                const res = await fetch(`${baseUrl}/connection`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create connection' };
                return { output: data };
            }
            case 'deleteConnection': {
                const res = await fetch(`${baseUrl}/connection/${inputs.connectionId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { deleted: true, connectionId: inputs.connectionId } };
                const data = await res.json();
                return { error: data.error || 'Failed to delete connection' };
            }
            case 'listIntegrations': {
                const res = await fetch(`${baseUrl}/config`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list integrations' };
                return { output: data };
            }
            case 'getIntegration': {
                const params = new URLSearchParams();
                if (inputs.includeCreds) params.set('include_creds', String(inputs.includeCreds));
                const res = await fetch(`${baseUrl}/config/${inputs.providerConfigKey}?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get integration' };
                return { output: data };
            }
            case 'createIntegration': {
                const body: Record<string, any> = {
                    provider: inputs.provider,
                    provider_config_key: inputs.providerConfigKey,
                };
                if (inputs.oauth_client_id) body.oauth_client_id = inputs.oauth_client_id;
                if (inputs.oauth_client_secret) body.oauth_client_secret = inputs.oauth_client_secret;
                if (inputs.oauth_scopes) body.oauth_scopes = inputs.oauth_scopes;
                const res = await fetch(`${baseUrl}/config`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create integration' };
                return { output: data };
            }
            case 'updateIntegration': {
                const body: Record<string, any> = { provider_config_key: inputs.providerConfigKey };
                if (inputs.oauth_client_id) body.oauth_client_id = inputs.oauth_client_id;
                if (inputs.oauth_client_secret) body.oauth_client_secret = inputs.oauth_client_secret;
                if (inputs.oauth_scopes) body.oauth_scopes = inputs.oauth_scopes;
                const res = await fetch(`${baseUrl}/config`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to update integration' };
                return { output: data };
            }
            case 'deleteIntegration': {
                const res = await fetch(`${baseUrl}/config/${inputs.providerConfigKey}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { deleted: true, providerConfigKey: inputs.providerConfigKey } };
                const data = await res.json();
                return { error: data.error || 'Failed to delete integration' };
            }
            case 'triggerSync': {
                const body: Record<string, any> = {
                    provider_config_key: inputs.providerConfigKey,
                    syncs: inputs.syncs,
                    connection_id: inputs.connectionId,
                };
                const res = await fetch(`${baseUrl}/sync/trigger`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to trigger sync' };
                return { output: data };
            }
            case 'getSyncStatus': {
                const params = new URLSearchParams({
                    provider_config_key: inputs.providerConfigKey,
                    syncs: inputs.syncs,
                    connection_id: inputs.connectionId,
                });
                const res = await fetch(`${baseUrl}/sync/status?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get sync status' };
                return { output: data };
            }
            case 'listRecords': {
                const params = new URLSearchParams({ model: inputs.model });
                if (inputs.delta) params.set('delta', inputs.delta);
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/sync/records?${params}`, {
                    headers: { ...headers, 'Connection-Id': inputs.connectionId, 'Provider-Config-Key': inputs.providerConfigKey },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list records' };
                return { output: data };
            }
            case 'getRecord': {
                const params = new URLSearchParams({ model: inputs.model, ids: inputs.id });
                const res = await fetch(`${baseUrl}/sync/records?${params}`, {
                    headers: { ...headers, 'Connection-Id': inputs.connectionId, 'Provider-Config-Key': inputs.providerConfigKey },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get record' };
                return { output: data };
            }
            case 'listSyncConfigs': {
                const params = new URLSearchParams();
                if (inputs.providerConfigKey) params.set('provider_config_key', inputs.providerConfigKey);
                const res = await fetch(`${baseUrl}/sync/configs?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list sync configs' };
                return { output: data };
            }
            case 'getEnvironment': {
                const res = await fetch(`${baseUrl}/environment-variables`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get environment' };
                return { output: data };
            }
            default:
                return { error: `Unknown Nango action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Nango error: ${err.message}`);
        return { error: err.message || 'Nango action failed' };
    }
}
