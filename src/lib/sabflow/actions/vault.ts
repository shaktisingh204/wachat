'use server';

export async function executeVaultAction(actionName: string, inputs: any, user: any, logger: any) {
    const token = inputs.token;
    const baseUrl = (inputs.vaultAddr ?? 'https://vault.example.com').replace(/\/$/, '');

    const headers: Record<string, string> = {
        'X-Vault-Token': token,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'readSecret': {
                const { path } = inputs;
                const res = await fetch(`${baseUrl}/v1/${path}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { secret: data } };
            }

            case 'writeSecret': {
                const { path, secretData } = inputs;
                const res = await fetch(`${baseUrl}/v1/${path}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(secretData),
                });
                if (res.status === 204) return { output: { written: true, path } };
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { result: data } };
            }

            case 'deleteSecret': {
                const { path } = inputs;
                const res = await fetch(`${baseUrl}/v1/${path}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { deleted: true, path } };
                const data = await res.json();
                return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
            }

            case 'listSecrets': {
                const { path } = inputs;
                const res = await fetch(`${baseUrl}/v1/${path}?list=true`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { keys: data?.data?.keys ?? [] } };
            }

            case 'readKV2': {
                const { mount = 'secret', path } = inputs;
                const res = await fetch(`${baseUrl}/v1/${mount}/data/${path}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { secret: data?.data?.data, metadata: data?.data?.metadata } };
            }

            case 'writeKV2': {
                const { mount = 'secret', path, secretData, cas } = inputs;
                const options: any = {};
                if (cas !== undefined) options.cas = cas;
                const res = await fetch(`${baseUrl}/v1/${mount}/data/${path}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ options, data: secretData }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { version: data?.data?.version, created_time: data?.data?.created_time } };
            }

            case 'deleteKV2': {
                const { mount = 'secret', path } = inputs;
                const res = await fetch(`${baseUrl}/v1/${mount}/data/${path}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { deleted: true, path } };
                const data = await res.json();
                return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
            }

            case 'listKV2': {
                const { mount = 'secret', path } = inputs;
                const res = await fetch(`${baseUrl}/v1/${mount}/metadata/${path}?list=true`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { keys: data?.data?.keys ?? [] } };
            }

            case 'readMetadataKV2': {
                const { mount = 'secret', path } = inputs;
                const res = await fetch(`${baseUrl}/v1/${mount}/metadata/${path}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { metadata: data?.data } };
            }

            case 'listPolicies': {
                const res = await fetch(`${baseUrl}/v1/sys/policies/acl?list=true`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { policies: data?.data?.keys ?? [] } };
            }

            case 'getPolicy': {
                const { policyName } = inputs;
                const res = await fetch(`${baseUrl}/v1/sys/policies/acl/${policyName}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { policy: data } };
            }

            case 'createPolicy': {
                const { policyName, policy } = inputs;
                const res = await fetch(`${baseUrl}/v1/sys/policies/acl/${policyName}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ policy }),
                });
                if (res.status === 204) return { output: { created: true, policyName } };
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { result: data } };
            }

            case 'updatePolicy': {
                const { policyName, policy } = inputs;
                const res = await fetch(`${baseUrl}/v1/sys/policies/acl/${policyName}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ policy }),
                });
                if (res.status === 204) return { output: { updated: true, policyName } };
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { result: data } };
            }

            case 'deletePolicy': {
                const { policyName } = inputs;
                const res = await fetch(`${baseUrl}/v1/sys/policies/acl/${policyName}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { deleted: true, policyName } };
                const data = await res.json();
                return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
            }

            case 'tokenLookup': {
                const { lookupToken } = inputs;
                const body = lookupToken ? { token: lookupToken } : {};
                const endpoint = lookupToken ? `${baseUrl}/v1/auth/token/lookup` : `${baseUrl}/v1/auth/token/lookup-self`;
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0] ?? `HTTP ${res.status}` };
                return { output: { tokenInfo: data?.data } };
            }

            default:
                return { error: `Unknown Vault action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Vault action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in Vault action' };
    }
}
