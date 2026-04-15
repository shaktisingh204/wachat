'use server';

const BASE_URL = 'https://api.imgix.com/api/v1';

export async function executeImgixAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        if (!apiKey) return { error: 'Missing required credential: apiKey' };

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/vnd.api+json',
        };

        const apiFetch = async (path: string, method = 'GET', body?: any) => {
            const res = await fetch(`${BASE_URL}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) return { _error: data.message || data.error || `Request failed: ${res.status}` };
            return data;
        };

        switch (actionName) {
            case 'listSources': {
                const data = await apiFetch('/sources');
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getSource': {
                const sourceId = inputs.sourceId;
                const data = await apiFetch(`/sources/${sourceId}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'createSource': {
                const payload = {
                    data: {
                        type: 'sources',
                        attributes: {
                            name: inputs.name,
                            deployment: inputs.deployment || {},
                        },
                    },
                };
                const data = await apiFetch('/sources', 'POST', payload);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'updateSource': {
                const sourceId = inputs.sourceId;
                const payload = {
                    data: {
                        type: 'sources',
                        id: sourceId,
                        attributes: inputs.attributes || {},
                    },
                };
                const data = await apiFetch(`/sources/${sourceId}`, 'PATCH', payload);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'listAssets': {
                const sourceId = inputs.sourceId;
                const params = new URLSearchParams();
                if (inputs.page) params.set('page[number]', String(inputs.page));
                if (inputs.pageSize) params.set('page[size]', String(inputs.pageSize));
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`/assets/search${query}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getAsset': {
                const sourceId = inputs.sourceId;
                const originPath = encodeURIComponent(inputs.originPath);
                const data = await apiFetch(`/assets/${sourceId}/origin/${originPath}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'purgeAsset': {
                const payload = {
                    data: {
                        type: 'purges',
                        attributes: {
                            url: inputs.url,
                        },
                    },
                };
                const data = await apiFetch('/purges', 'POST', payload);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'listPurgeRequests': {
                const data = await apiFetch('/purges');
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getPurgeRequest': {
                const purgeId = inputs.purgeId;
                const data = await apiFetch(`/purges/${purgeId}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'createPurgeRequest': {
                const payload = {
                    data: {
                        type: 'purges',
                        attributes: {
                            url: inputs.url,
                            source_id: inputs.sourceId,
                        },
                    },
                };
                const data = await apiFetch('/purges', 'POST', payload);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getUsage': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`/stats/usage${query}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getAnalytics': {
                const params = new URLSearchParams();
                if (inputs.sourceId) params.set('source_id', inputs.sourceId);
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`/stats${query}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'listAttributes': {
                const sourceId = inputs.sourceId;
                const data = await apiFetch(`/sources/${sourceId}/attributes`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getAttribute': {
                const sourceId = inputs.sourceId;
                const attributeId = inputs.attributeId;
                const data = await apiFetch(`/sources/${sourceId}/attributes/${attributeId}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'updateAttribute': {
                const sourceId = inputs.sourceId;
                const attributeId = inputs.attributeId;
                const payload = {
                    data: {
                        type: 'attributes',
                        id: attributeId,
                        attributes: inputs.attributes || {},
                    },
                };
                const data = await apiFetch(`/sources/${sourceId}/attributes/${attributeId}`, 'PATCH', payload);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            default:
                return { error: `Unknown imgix action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`imgix action error: ${err.message}`);
        return { error: err.message || 'imgix action failed' };
    }
}
